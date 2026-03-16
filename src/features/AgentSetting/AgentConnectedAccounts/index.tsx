'use client';

import { Empty, Flexbox, Icon, Tag } from '@lobehub/ui';
import { App, Button, Skeleton, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { BadgeCheckIcon, ExternalLinkIcon, Link2Icon, UnplugIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import { type DecryptedAgentCredential } from '@/database/models/agentCredential';
import { agentCredentialService } from '@/services/agentCredential';
import { agentOAuthService } from '@/services/agentOAuth';
import { useAgentStore } from '@/store/agent';
import { builtinAgentSelectors } from '@/store/agent/selectors';

const { Paragraph, Text, Title } = Typography;

interface ProviderDefinition {
  authType: 'oauth' | 'sandbox_session';
  descriptionKey:
    | 'agentConnections.providers.oauthDescription'
    | 'agentConnections.providers.sandboxDescription';
  provider: string;
  title: string;
}

const PROVIDERS: ProviderDefinition[] = [
  {
    authType: 'oauth',
    descriptionKey: 'agentConnections.providers.oauthDescription',
    provider: 'google',
    title: 'Google',
  },
  {
    authType: 'oauth',
    descriptionKey: 'agentConnections.providers.oauthDescription',
    provider: 'instagram',
    title: 'Instagram',
  },
  {
    authType: 'sandbox_session',
    descriptionKey: 'agentConnections.providers.sandboxDescription',
    provider: 'tiktok',
    title: 'TikTok',
  },
  {
    authType: 'oauth',
    descriptionKey: 'agentConnections.providers.oauthDescription',
    provider: 'youtube',
    title: 'YouTube',
  },
  {
    authType: 'oauth',
    descriptionKey: 'agentConnections.providers.oauthDescription',
    provider: 'linkedin',
    title: 'LinkedIn',
  },
  {
    authType: 'oauth',
    descriptionKey: 'agentConnections.providers.oauthDescription',
    provider: 'twitter',
    title: 'X',
  },
] as const;

const GOOGLE_PROVIDER = 'google';

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    gap: 16px;

    padding: 20px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: 16px;

    background: ${token.colorBgContainer};
  `,
  cardTitleRow: css`
    display: flex;
    gap: 12px;
    align-items: flex-start;
    justify-content: space-between;
  `,
  muted: css`
    color: ${token.colorTextDescription};
  `,
  statusRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  `,
}));

const AgentConnectedAccounts = memo(() => {
  const { modal, message } = App.useApp();
  const { styles } = useStyles();
  const { t } = useTranslation('setting');
  const agentId = useAgentStore((s) => s.activeAgentId);
  const isInbox = useAgentStore(builtinAgentSelectors.isInboxAgent);
  const [connectingProvider, setConnectingProvider] = useState<string | null>(null);

  const {
    data: credentials = [],
    isLoading,
    mutate,
  } = useSWR(
    agentId && !isInbox ? `/api/agent-credentials/${agentId}` : null,
    agentId && !isInbox ? () => agentCredentialService.getByAgentId(agentId) : null,
    {
      onError: (error) => {
        console.error('Failed to load agent credentials:', error);
        message.error(t('agentConnections.loadError'));
      },
    },
  );
  const { data: oauthProviders } = useSWR(
    !isInbox ? 'agent-oauth-providers' : null,
    () => agentOAuthService.getProviders(),
    {
      onError: (error) => {
        console.error('Failed to load agent OAuth providers:', error);
      },
    },
  );

  const credentialsByProvider = useMemo(
    () => new Map(credentials.map((item) => [item.provider, item])),
    [credentials],
  );

  const providerCards = useMemo(() => {
    const knownCards = PROVIDERS.map((provider) => ({
      ...provider,
      credential: credentialsByProvider.get(provider.provider),
    }));

    const unknownCards = credentials
      .filter((item) => !PROVIDERS.some((provider) => provider.provider === item.provider))
      .map((item) => ({
        authType: item.authType,
        credential: item,
        descriptionKey: 'agentConnections.providers.oauthDescription' as const,
        provider: item.provider,
        title: item.accountLabel || item.provider,
      }));

    return [...knownCards, ...unknownCards];
  }, [credentials, credentialsByProvider]);

  const handleDisconnect = useCallback(
    async (credential: DecryptedAgentCredential) => {
      modal.confirm({
        centered: true,
        content: t('agentConnections.disconnectConfirm.description', {
          provider: credential.provider,
        }),
        okButtonProps: { danger: true },
        okText: t('agentConnections.disconnect'),
        onOk: async () => {
          try {
            await agentCredentialService.delete(credential.id);
            message.success(t('agentConnections.disconnectSuccess'));
            await mutate();
          } catch (error) {
            console.error('Failed to delete agent credential:', error);
            message.error(t('agentConnections.disconnectError'));
          }
        },
        title: t('agentConnections.disconnectConfirm.title'),
      });
    },
    [message, modal, mutate, t],
  );

  const handleGoogleConnect = useCallback(async () => {
    if (!agentId) return;

    setConnectingProvider(GOOGLE_PROVIDER);
    try {
      const { authorizationUrl } = await agentOAuthService.initiateOAuth({
        agentId,
        provider: GOOGLE_PROVIDER,
      });

      const popup = window.open(authorizationUrl, '_blank', 'width=640,height=720');
      if (!popup) {
        message.error(t('agentConnections.popupBlocked'));
        setConnectingProvider(null);
      }
    } catch (error) {
      console.error('Failed to initiate Google OAuth:', error);
      message.error(t('agentConnections.connectError'));
      setConnectingProvider(null);
    }
  }, [agentId, message, t]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type !== 'AGENT_OAUTH_SUCCESS') return;
      if (event.data?.provider !== GOOGLE_PROVIDER) return;
      if (event.data?.agentId !== agentId) return;

      setConnectingProvider(null);
      message.success(t('agentConnections.connectSuccess'));
      void mutate();
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [agentId, message, mutate, t]);

  if (isInbox) {
    return (
      <Empty
        description={t('agentConnections.inboxDescription')}
        icon={Link2Icon}
        title={t('agentConnections.inboxTitle')}
      />
    );
  }

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} title={false} />;
  }

  return (
    <Flexbox gap={20}>
      <Flexbox gap={4}>
        <Title level={4} style={{ margin: 0 }}>
          {t('agentConnections.title')}
        </Title>
        <Paragraph className={styles.muted} style={{ margin: 0 }}>
          {t('agentConnections.description')}
        </Paragraph>
      </Flexbox>

      {!credentials.length && (
        <Empty
          description={t('agentConnections.empty.description')}
          icon={Link2Icon}
          title={t('agentConnections.empty.title')}
        />
      )}

      {providerCards.map(({ authType, credential, descriptionKey, provider, title }) => {
        const isConnected = !!credential;
        const isGoogle = provider === GOOGLE_PROVIDER;
        const isGoogleEnabled = !!oauthProviders?.google;
        const modeLabel =
          authType === 'sandbox_session'
            ? t('agentConnections.authType.sandbox_session')
            : t('agentConnections.authType.oauth');

        return (
          <Flexbox className={styles.card} key={provider}>
            <div className={styles.cardTitleRow}>
              <Flexbox gap={10}>
                <Flexbox
                  align={'center'}
                  justify={'center'}
                  style={{
                    background: 'var(--ant-color-fill-tertiary)',
                    borderRadius: 12,
                    height: 40,
                    width: 40,
                  }}
                >
                  <Icon icon={Link2Icon} size={18} />
                </Flexbox>
                <Flexbox gap={4}>
                  <Text strong>{title}</Text>
                  <Text className={styles.muted}>{t(descriptionKey)}</Text>
                </Flexbox>
              </Flexbox>

              {isConnected ? (
                <Tag color="success">
                  <Icon icon={BadgeCheckIcon} />
                  {t('agentConnections.connected')}
                </Tag>
              ) : (
                <Tag>{t('agentConnections.comingSoon')}</Tag>
              )}
            </div>

            <div className={styles.statusRow}>
              <Tag>{modeLabel}</Tag>
              {credential?.accountLabel && (
                <Tag>{t('agentConnections.accountLabel', { label: credential.accountLabel })}</Tag>
              )}
              {!!credential?.scopes?.length && (
                <Tag>{t('agentConnections.scopeCount', { count: credential.scopes.length })}</Tag>
              )}
            </div>

            <Flexbox horizontal align={'center'} gap={12} justify={'space-between'} wrap={'wrap'}>
              <Text className={styles.muted}>
                {isConnected
                  ? t('agentConnections.connectedDescription')
                  : t(
                      authType === 'sandbox_session'
                        ? 'agentConnections.pending.sandbox'
                        : 'agentConnections.pending.oauth',
                    )}
              </Text>

              {isConnected ? (
                <Button
                  danger
                  icon={<Icon icon={UnplugIcon} />}
                  onClick={() => handleDisconnect(credential)}
                >
                  {t('agentConnections.disconnect')}
                </Button>
              ) : isGoogle ? (
                <Button
                  disabled={!isGoogleEnabled}
                  icon={<Icon icon={ExternalLinkIcon} />}
                  loading={connectingProvider === GOOGLE_PROVIDER}
                  onClick={handleGoogleConnect}
                >
                  {isGoogleEnabled
                    ? t('agentConnections.connect')
                    : t('agentConnections.googleNotConfigured')}
                </Button>
              ) : (
                <Button disabled icon={<Icon icon={ExternalLinkIcon} />}>
                  {t('agentConnections.comingSoon')}
                </Button>
              )}
            </Flexbox>
          </Flexbox>
        );
      })}

      <Paragraph className={styles.muted} style={{ margin: 0 }}>
        {t('agentConnections.footer')}
      </Paragraph>
    </Flexbox>
  );
});

AgentConnectedAccounts.displayName = 'AgentConnectedAccounts';

export default AgentConnectedAccounts;

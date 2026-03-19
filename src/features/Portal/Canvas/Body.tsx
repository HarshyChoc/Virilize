'use client';

import { CHAT_PORTAL_MAX_WIDTH, CHAT_PORTAL_WIDTH } from '@lobechat/const';
import { Empty, Flexbox, Icon } from '@lobehub/ui';
import { App, Button, Skeleton, Typography } from 'antd';
import { createStyles } from 'antd-style';
import {
  ExternalLinkIcon,
  Maximize2Icon,
  Minimize2Icon,
  MonitorUpIcon,
  RefreshCcwIcon,
  ScreenShareIcon,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';

import { agentCanvasService } from '@/services/agentCanvas';
import { useChatStore } from '@/store/chat';
import { chatPortalSelectors } from '@/store/chat/selectors';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

const { Paragraph, Text } = Typography;

const useStyles = createStyles(({ css, token }) => ({
  body: css`
    overflow: hidden;
    height: 100%;
  `,
  iframe: css`
    width: 100%;
    height: 100%;
    border: 0;
    background: ${token.colorBgLayout};
  `,
  meta: css`
    color: ${token.colorTextDescription};
  `,
  shell: css`
    display: flex;
    flex-direction: column;
    height: 100%;
  `,
  toolbar: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;

    padding: 12px;
    border-block-end: 1px solid ${token.colorBorderSecondary};
  `,
}));

const CanvasBody = memo(() => {
  const { message } = App.useApp();
  const { styles } = useStyles();
  const agentId = useChatStore(chatPortalSelectors.canvasAgentId);
  const [portalWidth, updateSystemStatus] = useGlobalStore((s) => [
    systemStatusSelectors.portalWidth(s),
    s.updateSystemStatus,
  ]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewOnly, setViewOnly] = useState(true);
  const shellRef = useRef<HTMLDivElement>(null);

  const swrKey = useMemo(
    () =>
      agentId
        ? ['agent-canvas', agentId, viewOnly ? 'watch' : 'control', refreshKey].join(':')
        : null,
    [agentId, refreshKey, viewOnly],
  );
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    agentId ? () => agentCanvasService.getStream({ agentId, viewOnly }) : null,
    {
      onError: (err) => {
        console.error('Failed to load canvas stream:', err);
        message.error((err as Error).message);
      },
      revalidateOnFocus: false,
    },
  );

  const handleRefresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
    void mutate();
  }, [mutate]);

  const handleToggleControl = useCallback(() => {
    setViewOnly((value) => !value);
    setRefreshKey((value) => value + 1);
  }, []);

  const handleCompact = useCallback(() => {
    updateSystemStatus({ portalWidth: CHAT_PORTAL_WIDTH });
  }, [updateSystemStatus]);

  const handleExpand = useCallback(() => {
    const nextWidth =
      typeof window === 'undefined'
        ? CHAT_PORTAL_MAX_WIDTH
        : Math.min(CHAT_PORTAL_MAX_WIDTH, Math.max(CHAT_PORTAL_WIDTH, window.innerWidth - 32));
    updateSystemStatus({ portalWidth: nextWidth });
  }, [updateSystemStatus]);

  const handleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (shellRef.current?.requestFullscreen) {
        await shellRef.current.requestFullscreen();
      }
    } catch (error) {
      message.error((error as Error).message || 'Failed to change fullscreen state');
    }
  }, [message]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  if (!agentId) {
    return <Empty description="No agent selected for canvas" icon={ScreenShareIcon} />;
  }

  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 8 }} title={false} />;
  }

  if (error || !data?.streamUrl) {
    return (
      <Empty
        description="Unable to start the agent canvas stream"
        icon={ScreenShareIcon}
        title="Canvas unavailable"
      />
    );
  }

  return (
    <Flexbox className={styles.shell} ref={shellRef}>
      <div className={styles.toolbar}>
        <Flexbox gap={2}>
          <Text strong>Agent Canvas</Text>
          <Paragraph className={styles.meta} style={{ margin: 0 }}>
            Sandbox {data.sandboxId} · {viewOnly ? 'Watch only' : 'Interactive'} · Width{' '}
            {portalWidth}px
          </Paragraph>
        </Flexbox>
        <Flexbox horizontal gap={8}>
          <Button
            size="small"
            type={viewOnly ? 'primary' : 'default'}
            onClick={handleToggleControl}
          >
            {viewOnly ? 'Take control' : 'Switch to watch'}
          </Button>
          <Button icon={<Icon icon={Minimize2Icon} />} size="small" onClick={handleCompact}>
            Minimize
          </Button>
          <Button icon={<Icon icon={MonitorUpIcon} />} size="small" onClick={handleExpand}>
            Expand
          </Button>
          <Button
            icon={<Icon icon={isFullscreen ? Minimize2Icon : Maximize2Icon} />}
            size="small"
            onClick={handleFullscreen}
          >
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </Button>
          <Button icon={<Icon icon={RefreshCcwIcon} />} size="small" onClick={handleRefresh}>
            Refresh
          </Button>
          <Button
            icon={<Icon icon={ExternalLinkIcon} />}
            size="small"
            onClick={() => window.open(data.streamUrl, '_blank', 'noopener,noreferrer')}
          >
            Open
          </Button>
        </Flexbox>
      </div>
      <div className={styles.body}>
        <iframe className={styles.iframe} src={data.streamUrl} title="Agent Canvas" />
      </div>
    </Flexbox>
  );
});

export default CanvasBody;

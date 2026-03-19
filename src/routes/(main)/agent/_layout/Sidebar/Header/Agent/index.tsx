'use client';

import { ActionIcon, Avatar, Block, Flexbox, Text } from '@lobehub/ui';
import { ChevronsUpDownIcon, ScreenShareIcon } from 'lucide-react';
import { type PropsWithChildren } from 'react';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { DEFAULT_AVATAR, DEFAULT_INBOX_AVATAR } from '@/const/meta';
import { SkeletonItem } from '@/features/NavPanel/components/SkeletonList';
import { useAgentStore } from '@/store/agent';
import { agentSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';

import SwitchPanel from './SwitchPanel';

const Agent = memo<PropsWithChildren>(() => {
  const { t } = useTranslation(['chat', 'common']);

  const [isLoading, isInbox, title, avatar, backgroundColor] = useAgentStore((s) => [
    agentSelectors.isAgentConfigLoading(s),
    builtinAgentSelectors.isInboxAgent(s),
    agentSelectors.currentAgentTitle(s),
    agentSelectors.currentAgentAvatar(s),
    agentSelectors.currentAgentBackgroundColor(s),
  ]);
  const [activeAgentId, openCanvas] = useChatStore((s) => [s.activeAgentId, s.openCanvas]);

  const displayTitle = isInbox ? 'Virilize AI' : title || t('defaultSession', { ns: 'common' });

  if (isLoading) return <SkeletonItem height={32} padding={0} />;

  return (
    <SwitchPanel>
      <Block
        clickable
        horizontal
        align={'center'}
        gap={8}
        padding={2}
        variant={'borderless'}
        style={{
          minWidth: 32,
          overflow: 'hidden',
        }}
      >
        <Avatar
          avatar={isInbox ? DEFAULT_INBOX_AVATAR : avatar || DEFAULT_AVATAR}
          background={backgroundColor || undefined}
          shape={'square'}
          size={28}
        />
        <Text ellipsis weight={500}>
          {displayTitle}
        </Text>
        <Flexbox horizontal gap={2}>
          {!isInbox && activeAgentId && (
            <ActionIcon
              icon={ScreenShareIcon}
              style={{ width: 24 }}
              size={{
                blockSize: 28,
                size: 16,
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openCanvas(activeAgentId);
              }}
            />
          )}
          <ActionIcon
            icon={ChevronsUpDownIcon}
            size={{
              blockSize: 28,
              size: 16,
            }}
            style={{
              width: 24,
            }}
          />
        </Flexbox>
      </Block>
    </SwitchPanel>
  );
});

export default Agent;

import { ActionIcon, DropdownMenu, Flexbox, Icon } from '@lobehub/ui';
import { BotMessageSquareIcon, MoreHorizontal, Settings2Icon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import NavHeader from '@/features/NavHeader';
import ToggleRightPanelButton from '@/features/RightPanel/ToggleRightPanelButton';
import { useAgentStore } from '@/store/agent';

import AgentStatusTag from './AgentStatusTag';
import AutoSaveHint from './AutoSaveHint';

const Header = memo(() => {
  const { t } = useTranslation(['setting']);

  const menuItems = useMemo(
    () => [
      {
        icon: <Icon icon={Settings2Icon} />,
        key: 'advanced-settings',
        label: t('advancedSettings', { ns: 'setting' }),
        onClick: () => useAgentStore.setState({ showAgentSetting: true }),
      },
    ],
    [t],
  );

  return (
    <NavHeader
      left={
        <Flexbox horizontal gap={8}>
          <AutoSaveHint />
          <AgentStatusTag />
        </Flexbox>
      }
      right={
        <Flexbox horizontal align={'center'} gap={4}>
          <DropdownMenu items={menuItems}>
            <ActionIcon icon={MoreHorizontal} size={DESKTOP_HEADER_ICON_SIZE} />
          </DropdownMenu>
          <ToggleRightPanelButton icon={BotMessageSquareIcon} showActive={true} />
        </Flexbox>
      }
    />
  );
});

export default Header;

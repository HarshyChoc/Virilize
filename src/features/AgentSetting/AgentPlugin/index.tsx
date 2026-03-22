'use client';

import { type FormGroupItemType } from '@lobehub/ui';
import { Avatar, Button, Center, Empty, Flexbox, Form, Tag, Tooltip } from '@lobehub/ui';
import { Space, Switch } from 'antd';
import isEqual from 'fast-deep-equal';
import { BlocksIcon, LucideTrash2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import PluginAvatar from '@/components/Plugins/PluginAvatar';
import PluginTag from '@/components/Plugins/PluginTag';
import { FORM_STYLE } from '@/const/layoutTokens';
import { useFetchInstalledPlugins } from '@/hooks/useFetchInstalledPlugins';
import { pluginHelpers, useToolStore } from '@/store/tool';
import { toolSelectors } from '@/store/tool/selectors';

import { useStore } from '../store';
import AddPluginButton from './AddPluginButton';
import LoadingList from './LoadingList';
import LocalPluginItem from './LocalPluginItem';
import PluginAction from './PluginAction';

const AgentPlugin = memo(() => {
  const { t } = useTranslation('setting');

  const [userEnabledPlugins, toggleAgentPlugin] = useStore((s) => [
    s.config.plugins || [],
    s.toggleAgentPlugin,
  ]);

  const installedPlugins = useToolStore(toolSelectors.metaList, isEqual);

  const { isLoading } = useFetchInstalledPlugins();

  const isEmpty = installedPlugins.length === 0 && userEnabledPlugins.length === 0;

  //  =========== Plugin List =========== //

  const list = installedPlugins.map(({ identifier, type, meta, author }) => {
    const isCustomPlugin = type === 'customPlugin';

    return {
      avatar: <PluginAvatar avatar={pluginHelpers.getPluginAvatar(meta)} size={40} />,
      children: isCustomPlugin ? (
        <LocalPluginItem id={identifier} />
      ) : (
        <PluginAction identifier={identifier} />
      ),
      desc: pluginHelpers.getPluginDesc(meta),
      label: (
        <Flexbox horizontal align={'center'} gap={8}>
          {pluginHelpers.getPluginTitle(meta)}
          <PluginTag author={author} type={type} />
        </Flexbox>
      ),
      layout: 'horizontal',
      minWidth: undefined,
    };
  });

  //  =========== Deprecated Plugin List =========== //

  // Find plugins that are not in installedPlugins
  const deprecatedList = userEnabledPlugins
    .filter((pluginId) => !installedPlugins.some((p) => p.identifier === pluginId))
    .map((id) => ({
      avatar: <Avatar avatar={'♻️'} shape={'square'} size={40} />,
      children: (
        <Switch
          checked={true}
          onChange={() => {
            toggleAgentPlugin(id);
          }}
        />
      ),
      label: (
        <Flexbox horizontal align={'center'} gap={8}>
          {id}
          <Tag color={'red'}>{t('plugin.installStatus.deprecated')}</Tag>
        </Flexbox>
      ),
      layout: 'horizontal',
      minWidth: undefined,
      tag: id,
    }));

  const hasDeprecated = deprecatedList.length > 0;

  const loadingSkeleton = LoadingList();

  const extra = (
    <Space.Compact style={{ width: 'auto' }}>
      <AddPluginButton />
      {hasDeprecated ? (
        <Tooltip title={t('plugin.clearDeprecated')}>
          <Button
            icon={LucideTrash2}
            size={'small'}
            onClick={(e) => {
              e.stopPropagation();
              for (const i of deprecatedList) {
                toggleAgentPlugin(i.tag as string);
              }
            }}
          />
        </Tooltip>
      ) : null}
    </Space.Compact>
  );

  const empty = (
    <Center padding={40}>
      <Empty
        description={t('plugin.empty')}
        descriptionProps={{ fontSize: 14 }}
        icon={BlocksIcon}
        style={{ maxWidth: 400 }}
      />
    </Center>
  );

  const plugin: FormGroupItemType = {
    children: isLoading ? loadingSkeleton : isEmpty ? empty : [...deprecatedList, ...list],
    extra,
    title: t('settingPlugin.title'),
  };

  return <Form items={[plugin]} itemsType={'group'} variant={'borderless'} {...FORM_STYLE} />;
});

export default AgentPlugin;

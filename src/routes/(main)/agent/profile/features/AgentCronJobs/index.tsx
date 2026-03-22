'use client';

import { Button, Empty, Flexbox } from '@lobehub/ui';
import { Typography } from 'antd';
import { Clock, Plus } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import urlJoin from 'url-join';

import { useQueryRoute } from '@/hooks/useQueryRoute';
import { useAgentStore } from '@/store/agent';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

import CronJobCards from './CronJobCards';
import { useAgentCronJobs } from './hooks/useAgentCronJobs';

const { Title } = Typography;

const AgentCronJobs = memo(() => {
  const { t } = useTranslation('setting');
  const agentId = useAgentStore((s) => s.activeAgentId);
  const router = useQueryRoute();
  const enableBusinessFeatures = useServerConfigStore(serverConfigSelectors.enableBusinessFeatures);

  const { cronJobs, loading, deleteCronJob } = useAgentCronJobs(agentId, enableBusinessFeatures);

  const handleCreate = useCallback(() => {
    if (!agentId) return;
    router.push(urlJoin('/agent', agentId, 'cron', 'new'));
  }, [agentId, router]);

  const handleEdit = useCallback(
    (jobId: string) => {
      if (!agentId) return;
      router.push(urlJoin('/agent', agentId, 'cron', jobId));
    },
    [agentId, router],
  );

  const handleDelete = useCallback(
    async (jobId: string) => {
      await deleteCronJob(jobId);
    },
    [deleteCronJob],
  );

  if (!enableBusinessFeatures) return null;
  if (!agentId) return null;

  const hasCronJobs = cronJobs.length > 0;

  return (
    <Flexbox gap={12} style={{ marginBottom: 16, marginTop: 16 }}>
      <Flexbox horizontal align="center" gap={8} justify="space-between">
        <Title level={5} style={{ margin: 0 }}>
          <Flexbox horizontal align="center" gap={8}>
            <Clock size={16} />
            {t('agentCronJobs.title')}
          </Flexbox>
        </Title>
        <Button icon={Plus} size={'small'} variant={'outlined'} onClick={handleCreate}>
          {t('agentCronJobs.addJob')}
        </Button>
      </Flexbox>

      {hasCronJobs ? (
        <CronJobCards
          cronJobs={cronJobs}
          loading={loading}
          onDelete={handleDelete}
          onEdit={handleEdit}
        />
      ) : (
        <Flexbox
          align={'center'}
          gap={12}
          padding={24}
          style={{ border: '1px dashed rgba(0,0,0,0.12)', borderRadius: 12 }}
        >
          <Empty
            description={t('agentCronJobs.empty.description')}
            title={t('agentCronJobs.empty.title')}
          />
          <Button icon={Plus} onClick={handleCreate}>
            {t('agentCronJobs.addJob')}
          </Button>
        </Flexbox>
      )}
    </Flexbox>
  );
});

export default AgentCronJobs;

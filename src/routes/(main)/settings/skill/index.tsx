'use client';

import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';

const Page = () => {
  const { t } = useTranslation('setting');
  return <Navigate replace state={{ reason: t('tab.skill') }} to="/settings/tool" />;
};

Page.displayName = 'SkillsSetting';

export default Page;

import { Flexbox } from '@lobehub/ui';
import { type FC } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

import Sidebar from './Sidebar';
import { styles } from './style';

const Layout: FC = () => {
  const { showMarket } = useServerConfigStore(featureFlagsSelectors);

  if (!showMarket) {
    return <Navigate replace to="/" />;
  }

  return (
    <>
      <Sidebar />
      <Flexbox className={styles.mainContainer} flex={1} height={'100%'}>
        <Outlet />
      </Flexbox>
      {/* ↓ cloud slot ↓ */}

      {/* ↑ cloud slot ↑ */}
    </>
  );
};

export default Layout;

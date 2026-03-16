import { Navigate, Outlet } from 'react-router-dom';

import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

const Layout = () => {
  const { showMarket } = useServerConfigStore(featureFlagsSelectors);

  if (!showMarket) {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
};

export default Layout;

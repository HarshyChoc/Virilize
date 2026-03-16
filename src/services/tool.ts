import { lambdaClient } from '@/libs/trpc/client';
import { globalHelpers } from '@/store/global/helpers';
import { type PluginQueryParams } from '@/types/discover';
import { convertOpenAIManifestToLobeManifest, getToolManifest } from '@/utils/toolManifest';

const isMarketEnabledOnClient = () => {
  if (typeof window === 'undefined' || !window.global_serverConfigStore) return false;

  try {
    return !!window.global_serverConfigStore.getState().featureFlags.showMarket;
  } catch {
    return false;
  }
};

class ToolService {
  getOldPluginList = async (params: PluginQueryParams): Promise<any> => {
    if (!isMarketEnabledOnClient()) {
      return {
        currentPage: params.page ? Number(params.page) : 1,
        items: [],
        pageSize: params.pageSize ? Number(params.pageSize) : 20,
        totalCount: 0,
        totalPages: 0,
      };
    }

    const locale = globalHelpers.getCurrentLanguage();

    return lambdaClient.market.getPluginList.query({
      ...params,
      locale,
      page: params.page ? Number(params.page) : 1,
      pageSize: params.pageSize ? Number(params.pageSize) : 20,
    });
  };

  getToolManifest = getToolManifest;
  convertOpenAIManifestToLobeManifest = convertOpenAIManifestToLobeManifest;
}

export const toolService = new ToolService();

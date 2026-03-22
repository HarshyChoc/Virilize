import {
  BriefcaseIcon,
  CheckSquareIcon,
  CloudIcon,
  CodeIcon,
  CoffeeIcon,
  CompassIcon,
  DollarSignIcon,
  GamepadIcon,
  GraduationCapIcon,
  HammerIcon,
  ImageIcon,
  LayoutPanelTopIcon,
  LeafIcon,
  MapIcon,
  NewspaperIcon,
  SearchIcon,
  UsersIcon,
} from 'lucide-react';
import { useMemo } from 'react';

import { McpCategory } from '@/types/discover';

export const useCategory = () => {
  return useMemo(
    () => [
      {
        icon: CompassIcon,
        key: McpCategory.Discover,
        label: 'Discover',
        title: 'Recommended MCP servers',
      },
      {
        icon: LayoutPanelTopIcon,
        key: McpCategory.All,
        label: 'All',
        title: 'All MCP servers',
      },
      {
        icon: CodeIcon,
        key: McpCategory.Developer,
        label: 'Developer Tools',
        title: 'Developer-related tools and services',
      },
      {
        icon: CheckSquareIcon,
        key: McpCategory.Productivity,
        label: 'Productivity',
        title: 'Productivity and workflow tools',
      },
      {
        icon: HammerIcon,
        key: McpCategory.Tools,
        label: 'Utility Tools',
        title: 'General utility tools',
      },
      {
        icon: SearchIcon,
        key: McpCategory.WebSearch,
        label: 'Web Search',
        title: 'Search and crawling tools',
      },
      {
        icon: ImageIcon,
        key: McpCategory.MediaGenerate,
        label: 'Media Generation',
        title: 'Image and media generation tools',
      },
      {
        icon: BriefcaseIcon,
        key: McpCategory.Business,
        label: 'Business Services',
        title: 'Business and enterprise services',
      },
      {
        icon: GraduationCapIcon,
        key: McpCategory.ScienceEducation,
        label: 'Science & Education',
        title: 'Science and education tools',
      },
      {
        icon: DollarSignIcon,
        key: McpCategory.StocksFinance,
        label: 'Stocks & Finance',
        title: 'Stocks and finance tools',
      },
      {
        icon: NewspaperIcon,
        key: McpCategory.News,
        label: 'News',
        title: 'News and current-events tools',
      },
      {
        icon: UsersIcon,
        key: McpCategory.Social,
        label: 'Social Media',
        title: 'Social platforms and communication tools',
      },
      {
        icon: GamepadIcon,
        key: McpCategory.GamingEntertainment,
        label: 'Gaming & Entertainment',
        title: 'Gaming and entertainment tools',
      },
      {
        icon: CoffeeIcon,
        key: McpCategory.Lifestyle,
        label: 'Lifestyle',
        title: 'Lifestyle tools and services',
      },
      {
        icon: LeafIcon,
        key: McpCategory.HealthWellness,
        label: 'Health & Wellness',
        title: 'Health and wellness services',
      },
      {
        icon: MapIcon,
        key: McpCategory.TravelTransport,
        label: 'Travel & Transport',
        title: 'Travel and transport tools',
      },
      {
        icon: CloudIcon,
        key: McpCategory.Weather,
        label: 'Weather',
        title: 'Weather services',
      },
    ],
    [],
  );
};

export const useCategoryItem = (key?: McpCategory) => {
  const items = useCategory();
  if (!key) return;
  return items.find((item) => item.key === key);
};

import {
  AppleIcon,
  BarChart2Icon,
  BookIcon,
  BookOpenIcon,
  BotIcon,
  BrainIcon,
  CalendarIcon,
  CheckSquareIcon,
  CloudIcon,
  DollarSignIcon,
  FileTextIcon,
  GamepadIcon,
  GitBranchIcon,
  GlobeIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  LayoutPanelTopIcon,
  MegaphoneIcon,
  MessageCircleIcon,
  MicIcon,
  MonitorIcon,
  NetworkIcon,
  PlayIcon,
  SearchIcon,
  ServerIcon,
  ShieldIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  TerminalIcon,
  TruckIcon,
  UserIcon,
  WrenchIcon,
} from 'lucide-react';
import { useMemo } from 'react';

import { SkillCategory } from '@/types/discover';

export const useSkillCategory = () => {
  return useMemo(
    () => [
      {
        icon: LayoutPanelTopIcon,
        key: SkillCategory.All,
        label: 'All',
        title: 'All skills',
      },
      // Sorted by category count (descending)
      {
        icon: BotIcon,
        key: SkillCategory.CodingAgentsIDEs,
        label: 'Coding Agents & IDEs',
        title: 'Coding agents and IDE helpers',
      },
      {
        icon: MonitorIcon,
        key: SkillCategory.WebFrontendDevelopment,
        label: 'Web & Frontend Development',
        title: 'Web and frontend development tools',
      },
      {
        icon: CloudIcon,
        key: SkillCategory.DevOpsCloud,
        label: 'DevOps & Cloud',
        title: 'DevOps and cloud tooling',
      },
      {
        icon: SearchIcon,
        key: SkillCategory.SearchResearch,
        label: 'Search & Research',
        title: 'Search and research tools',
      },
      {
        icon: GlobeIcon,
        key: SkillCategory.BrowserAutomation,
        label: 'Browser Automation',
        title: 'Browser automation tools',
      },
      {
        icon: CheckSquareIcon,
        key: SkillCategory.ProductivityTasks,
        label: 'Productivity & Tasks',
        title: 'Productivity and task tools',
      },
      {
        icon: BrainIcon,
        key: SkillCategory.AILLMs,
        label: 'AI & LLMs',
        title: 'AI and LLM related tools',
      },
      {
        icon: TerminalIcon,
        key: SkillCategory.CLIUtilities,
        label: 'CLI Utilities',
        title: 'Command-line utilities',
      },
      {
        icon: GitBranchIcon,
        key: SkillCategory.GitGitHub,
        label: 'Git & GitHub',
        title: 'Git and GitHub workflows',
      },
      {
        icon: ImageIcon,
        key: SkillCategory.ImageVideoGeneration,
        label: 'Image & Video Generation',
        title: 'Image and video generation tools',
      },
      {
        icon: MessageCircleIcon,
        key: SkillCategory.Communication,
        label: 'Communication',
        title: 'Communication and messaging tools',
      },
      {
        icon: TruckIcon,
        key: SkillCategory.Transportation,
        label: 'Transportation',
        title: 'Transportation services',
      },
      {
        icon: FileTextIcon,
        key: SkillCategory.PDFDocuments,
        label: 'PDF & Documents',
        title: 'PDF and document handling',
      },
      {
        icon: MegaphoneIcon,
        key: SkillCategory.MarketingSales,
        label: 'Marketing & Sales',
        title: 'Marketing and sales tools',
      },
      {
        icon: HeartIcon,
        key: SkillCategory.HealthFitness,
        label: 'Health & Fitness',
        title: 'Health and fitness tools',
      },
      {
        icon: PlayIcon,
        key: SkillCategory.MediaStreaming,
        label: 'Media & Streaming',
        title: 'Media and streaming services',
      },
      {
        icon: BookOpenIcon,
        key: SkillCategory.NotesPKM,
        label: 'Notes & PKM',
        title: 'Notes and personal knowledge management',
      },
      {
        icon: CalendarIcon,
        key: SkillCategory.CalendarScheduling,
        label: 'Calendar & Scheduling',
        title: 'Calendar and scheduling tools',
      },
      {
        icon: ShoppingCartIcon,
        key: SkillCategory.ShoppingEcommerce,
        label: 'Shopping & Ecommerce',
        title: 'Shopping and ecommerce tools',
      },
      {
        icon: ShieldIcon,
        key: SkillCategory.SecurityPasswords,
        label: 'Security & Passwords',
        title: 'Security and password tools',
      },
      {
        icon: UserIcon,
        key: SkillCategory.PersonalDevelopment,
        label: 'Personal Development',
        title: 'Personal development tools',
      },
      {
        icon: MicIcon,
        key: SkillCategory.SpeechTranscription,
        label: 'Speech & Transcription',
        title: 'Speech and transcription tools',
      },
      {
        icon: AppleIcon,
        key: SkillCategory.AppleAppsServices,
        label: 'Apple Apps & Services',
        title: 'Apple apps and services',
      },
      {
        icon: HomeIcon,
        key: SkillCategory.SmartHomeIoT,
        label: 'Smart Home & IoT',
        title: 'Smart home and IoT tools',
      },
      {
        icon: GamepadIcon,
        key: SkillCategory.Gaming,
        label: 'Gaming',
        title: 'Gaming tools',
      },
      {
        icon: WrenchIcon,
        key: SkillCategory.ClawdbotTools,
        label: 'Clawdbot Tools',
        title: 'Clawdbot-related tools',
      },
      {
        icon: ServerIcon,
        key: SkillCategory.SelfHostedAutomation,
        label: 'Self-hosted Automation',
        title: 'Self-hosted automation tools',
      },
      {
        icon: SmartphoneIcon,
        key: SkillCategory.IOSMacOSDevelopment,
        label: 'iOS & macOS Development',
        title: 'Apple platform development',
      },
      {
        icon: BookIcon,
        key: SkillCategory.Moltbook,
        label: 'Moltbook',
        title: 'Moltbook tools',
      },
      {
        icon: BarChart2Icon,
        key: SkillCategory.DataAnalytics,
        label: 'Data & Analytics',
        title: 'Data and analytics tools',
      },
      {
        icon: DollarSignIcon,
        key: SkillCategory.Finance,
        label: 'Finance',
        title: 'Finance tools',
      },
      {
        icon: NetworkIcon,
        key: SkillCategory.AgentToAgentProtocols,
        label: 'Agent-to-Agent Protocols',
        title: 'Agent protocol tools',
      },
    ],
    [],
  );
};

export const useSkillCategoryItem = (key?: string) => {
  const items = useSkillCategory();
  if (!key) return;
  return items.find((item) => item.key === key);
};

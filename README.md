# Prompt Lab

任务协作工作台，一个基于 Vue 3 的前端项目。

## 技术栈

- Vue 3 + TypeScript
- Vite 构建
- Pinia 状态管理
- Element Plus UI
- Vitest 单元测试

## 功能模块

- **仪表盘** - 项目执行概览、健康度指标
- **任务看板** - 任务管理、状态流转、批量操作
- **报表中心** - 数据统计、趋势分析
- **运维中心** - 数据同步、SLA 检查、依赖校验
- **系统设置** - 主题切换、会话管理

## 快速开始

```bash
npm install
npm run dev
```

## 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 构建生产版本 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 运行单元测试（watch 模式） |
| `npm run test:run` | 运行单元测试（单次） |

## 目录结构

```
src/
├── components/    # 通用组件
├── composables/   # 组合式函数
├── constants/     # 常量定义
├── layout/        # 布局组件
├── mock/          # 模拟数据
├── router/        # 路由配置
├── services/      # 服务层
├── store/         # Pinia 状态管理
├── types/         # TypeScript 类型
├── utils/         # 工具函数
└── views/         # 页面视图
tests/             # 测试文件
```

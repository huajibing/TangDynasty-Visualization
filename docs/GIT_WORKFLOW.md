# Git 工作流与版本控制规范

本文档定义项目的 Git 使用规范、分支策略和协作流程。

## 1. 分支策略

### 1.1 分支命名

```
main                    # 主分支，生产环境代码
├── develop            # 开发分支，集成测试
├── feature/xxx        # 功能分支
├── bugfix/xxx         # 问题修复分支
├── hotfix/xxx         # 紧急修复分支
└── release/x.x.x      # 发布分支
```

### 1.2 分支说明

| 分支类型 | 命名规范 | 来源分支 | 合并目标 | 说明 |
|---------|---------|---------|---------|------|
| main | `main` | - | - | 生产环境，受保护 |
| develop | `develop` | main | main | 开发集成分支 |
| feature | `feature/{模块}-{描述}` | develop | develop | 新功能开发 |
| bugfix | `bugfix/{issue号}-{描述}` | develop | develop | Bug 修复 |
| hotfix | `hotfix/{issue号}-{描述}` | main | main, develop | 紧急修复 |
| release | `release/v{版本号}` | develop | main, develop | 版本发布 |

### 1.3 分支命名示例

```bash
# 功能分支
feature/map-zoom
feature/histogram-brush
feature/network-graph
feature/data-filter

# Bug 修复
bugfix/12-tooltip-position
bugfix/15-scale-domain-error

# 紧急修复
hotfix/20-data-loading-failure

# 发布分支
release/v1.0.0
release/v1.1.0
```

## 2. 提交规范

### 2.1 Commit Message 格式

采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 2.2 Type 类型

| Type | 说明 | 示例 |
|------|------|------|
| feat | 新功能 | `feat(map): add zoom functionality` |
| fix | Bug 修复 | `fix(tooltip): correct position calculation` |
| docs | 文档更新 | `docs: update README with setup instructions` |
| style | 代码格式（不影响功能） | `style: format code with prettier` |
| refactor | 重构（不是新功能或修复） | `refactor(data): simplify merge logic` |
| perf | 性能优化 | `perf(render): use requestAnimationFrame` |
| test | 测试相关 | `test(histogram): add unit tests` |
| chore | 构建/工具变更 | `chore: update eslint config` |

### 2.3 Scope 范围

项目中使用的 scope：

- `map` - 地图组件
- `histogram` - 直方图组件
- `scatter` - 散点图组件
- `network` - 网络图组件
- `data` - 数据处理模块
- `state` - 状态管理
- `tooltip` - 提示框组件
- `legend` - 图例组件
- `filter` - 筛选器
- `style` - 样式相关
- `config` - 配置相关

### 2.4 Subject 规则

- 使用祈使句（动词原形开头）
- 首字母小写
- 不加句号
- 不超过 50 个字符

```bash
# 好的示例
feat(map): add click event handler
fix(data): handle null population values
refactor(chart): extract base chart class

# 不好的示例
feat(map): Added click event handler    # 不要用过去式
fix(data): Handle null population values.  # 首字母不要大写，不要加句号
refactor(chart): Extracted base chart class because it was needed  # 太长
```

### 2.5 Body 说明

- 用于解释 **为什么** 做这个改动
- 每行不超过 72 个字符
- 与 subject 之间空一行

```bash
feat(histogram): add brush interaction

Add d3.brush to histogram for range selection.
This enables users to filter locations by household size range,
which addresses the task of identifying outliers (Task 2).

The brush selection will trigger state updates and highlight
corresponding points on other charts.
```

### 2.6 Footer 说明

- 关联 Issue：`Closes #123` 或 `Fixes #123`
- 破坏性变更：`BREAKING CHANGE: description`

```bash
fix(data): correct household size calculation

The previous formula didn't handle zero households correctly,
causing division by zero errors.

Fixes #15
```

### 2.7 完整示例

```bash
feat(map): implement zoom to selected region

Add zoomToLocations() method that calculates bounds from selected
location coordinates and smoothly transitions the map view to
focus on that area.

- Calculate bounding box from location coordinates
- Use d3.zoom to animate transition
- Add padding around the bounds for better visibility

This feature helps users explore specific regions (e.g., a single
Dao) without manual zooming.

Closes #8
```

## 3. 工作流程

### 3.1 开发新功能

```bash
# 1. 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/map-zoom

# 2. 开发并提交
git add .
git commit -m "feat(map): add basic zoom controls"

# 3. 推送到远程
git push -u origin feature/map-zoom

# 4. 创建 Pull Request
# 在 GitHub/GitLab 上创建 PR，请求合并到 develop

# 5. 代码审查后合并
# 在 PR 页面点击 Merge（使用 Squash and Merge）

# 6. 删除功能分支
git checkout develop
git pull origin develop
git branch -d feature/map-zoom
```

### 3.2 修复 Bug

```bash
# 1. 从 develop 创建修复分支
git checkout develop
git pull origin develop
git checkout -b bugfix/12-tooltip-position

# 2. 修复并提交
git add .
git commit -m "fix(tooltip): correct position near viewport edge

Add boundary detection to prevent tooltip from rendering
outside the visible area.

Fixes #12"

# 3. 推送并创建 PR
git push -u origin bugfix/12-tooltip-position
```

### 3.3 紧急修复

```bash
# 1. 从 main 创建 hotfix 分支
git checkout main
git pull origin main
git checkout -b hotfix/critical-data-error

# 2. 修复并提交
git add .
git commit -m "fix(data): handle missing coordinate gracefully

Prevent app crash when location has null coordinates.

Fixes #20"

# 3. 推送并创建 PR 到 main
git push -u origin hotfix/critical-data-error

# 4. 合并到 main 后，同步到 develop
git checkout develop
git merge main
git push origin develop
```

### 3.4 版本发布

```bash
# 1. 从 develop 创建发布分支
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0

# 2. 更新版本号（package.json 等）
# 进行最后的测试和修复

# 3. 合并到 main 并打标签
git checkout main
git merge release/v1.0.0
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin main --tags

# 4. 同步回 develop
git checkout develop
git merge main
git push origin develop

# 5. 删除发布分支
git branch -d release/v1.0.0
```

## 4. 代码审查

### 4.1 PR 描述模板

```markdown
## 概述
简要描述本次更改的内容和目的。

## 更改内容
- [ ] 功能点 1
- [ ] 功能点 2
- [ ] 功能点 3

## 测试
描述如何测试这些更改：
1. 步骤 1
2. 步骤 2
3. 预期结果

## 截图（如适用）
添加 UI 变更的截图。

## 关联 Issue
Closes #XX

## 检查清单
- [ ] 代码符合项目规范
- [ ] 已添加必要的注释
- [ ] 已更新相关文档
- [ ] 已在本地测试通过
```

### 4.2 审查要点

**代码质量**
- [ ] 命名清晰，符合规范
- [ ] 函数职责单一
- [ ] 无明显的性能问题
- [ ] 无安全漏洞

**可视化特定**
- [ ] 图表响应式正常
- [ ] 交互反馈及时
- [ ] 数据绑定正确
- [ ] 动画流畅

**兼容性**
- [ ] 主流浏览器测试通过
- [ ] 不同屏幕尺寸适配

## 5. 版本管理

### 5.1 语义化版本

采用 [Semantic Versioning](https://semver.org/)：`MAJOR.MINOR.PATCH`

| 版本号 | 说明 | 示例场景 |
|--------|------|----------|
| MAJOR | 不兼容的 API 变更 | 数据格式重大变更 |
| MINOR | 向后兼容的功能新增 | 添加新图表组件 |
| PATCH | 向后兼容的问题修复 | 修复 Tooltip 位置 |

### 5.2 版本历史示例

```
v1.0.0 - 初始发布
  - 地图视图
  - 直方图
  - 散点图
  - 基础交互

v1.1.0 - 网络图功能
  - 添加物产共现网络图
  - 改进 Tooltip 样式

v1.1.1 - Bug 修复
  - 修复大数据量渲染性能问题
  - 修复移动端触摸事件

v1.2.0 - 筛选功能增强
  - 添加道级别筛选器
  - 添加物产类型筛选
  - 改进联动交互
```

## 6. Git 配置

### 6.1 .gitignore

```gitignore
# 依赖
node_modules/

# 构建产物
dist/
build/

# 编辑器
.idea/
.vscode/
*.swp
*.swo

# 系统文件
.DS_Store
Thumbs.db

# 日志
*.log
npm-debug.log*

# 环境变量
.env
.env.local
.env.*.local

# 临时文件
tmp/
temp/
*.tmp
```

### 6.2 .gitattributes

```gitattributes
# 文本文件自动处理换行符
* text=auto

# 指定文件类型
*.js text eol=lf
*.css text eol=lf
*.html text eol=lf
*.json text eol=lf
*.md text eol=lf

# 二进制文件
*.png binary
*.jpg binary
*.gif binary
*.ico binary
*.woff binary
*.woff2 binary
```

### 6.3 推荐的 Git 配置

```bash
# 用户信息
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 默认分支名
git config init.defaultBranch main

# 自动处理换行符
git config core.autocrlf input  # Mac/Linux
git config core.autocrlf true   # Windows

# 设置默认编辑器
git config core.editor "code --wait"

# 设置 diff 工具
git config diff.tool vscode
git config difftool.vscode.cmd "code --wait --diff $LOCAL $REMOTE"

# 启用颜色
git config color.ui auto

# 设置别名
git config alias.st status
git config alias.co checkout
git config alias.br branch
git config alias.ci commit
git config alias.lg "log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
```

## 7. 常用命令速查

```bash
# 查看状态
git status
git log --oneline -10

# 分支操作
git branch -a                    # 查看所有分支
git checkout -b feature/xxx      # 创建并切换分支
git branch -d feature/xxx        # 删除本地分支
git push origin --delete xxx     # 删除远程分支

# 暂存操作
git stash                        # 暂存当前修改
git stash pop                    # 恢复暂存
git stash list                   # 查看暂存列表

# 撤销操作
git checkout -- <file>           # 撤销工作区修改
git reset HEAD <file>            # 撤销暂存
git reset --soft HEAD^           # 撤销上次提交（保留修改）
git reset --hard HEAD^           # 撤销上次提交（丢弃修改）

# 合并操作
git merge <branch>               # 合并分支
git rebase <branch>              # 变基
git cherry-pick <commit>         # 挑选提交

# 远程操作
git remote -v                    # 查看远程仓库
git fetch origin                 # 获取远程更新
git pull origin develop          # 拉取并合并
git push -u origin feature/xxx   # 推送新分支
```

## 8. 问题排查

### 8.1 常见问题

**合并冲突**
```bash
# 查看冲突文件
git status

# 解决冲突后
git add <resolved-file>
git commit -m "resolve merge conflict"
```

**误删分支恢复**
```bash
# 查找被删除分支的最后一次提交
git reflog

# 恢复分支
git checkout -b <branch-name> <commit-hash>
```

**回退到指定版本**
```bash
# 软回退（保留修改）
git reset --soft <commit-hash>

# 硬回退（丢弃修改）
git reset --hard <commit-hash>

# 创建回退提交（推荐用于已推送的代码）
git revert <commit-hash>
```

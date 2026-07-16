# 入门

## 你需要准备什么

Ensembler 在 Docker 中运行你的服务，因此你需要安装并运行一个**容器运行时** ——
也就是能提供 `docker` 和 `docker compose` 命令的东西。

- **推荐（最简单）：**
  [Docker Desktop](https://www.docker.com/products/docker-desktop/) —— 面向
  macOS、Windows 和 Linux 的一键安装。如果你还没有安装，Ensembler 会在首次启动时
  引导你去获取它。
- **已经在用别的？** 任何兼容 Docker 的运行时都同样适用 ——
  例如 **OrbStack**（macOS）、**Podman**、**Rancher Desktop**、
  **colima**，或 Linux 上的 **Docker Engine**。只要 `docker` 和
  `docker compose` 能正常工作，Ensembler 就会使用它们。

你**不需要** Node.js、终端或任何开发者工具就能使用本应用。

## 首次启动

当你第一次打开 Ensembler 时，它会检查 Docker 是否正在运行。如果
Docker 尚未安装或未启动，你会看到修复的指引 —— 启动
Docker Desktop，等它显示正在运行，Ensembler 便会继续。

## 设置向导

### 1. 选择你的服务
推荐的服务已被预先选中，可构成一套完整的媒体中心。有些类别 ——
下载客户端、索引器管理器和请求工具 —— 只让你选择单个选项；
另一些类别 —— 媒体服务器和媒体管理 —— 则允许你选择多个（例如，同时运行
Plex 和 Jellyfin）。

### 2. 设置你的文件夹
告诉 Ensembler 你的**电视剧**、**电影**和**下载**存放在哪里。
这些是你自己的文件夹 —— 请选择有足够空间容纳你媒体库的位置。
端口会被自动检查，如果某个默认端口已被占用，
Ensembler 会悄悄为你选取一个空闲的端口。

### 3. 应用
Ensembler 会生成配置、启动你的服务，并把它们相互
连接起来。你会看到每一步逐一完成。

## 完成设置

有几个步骤只能由你来完成，仪表盘会在一个
**"完成设置"** 列表中提示你处理它们：

- **在 Prowlarr 中添加一个索引器** —— 以便 Sonarr 和 Radarr 能搜索内容。
  你自己选择内容来源；Ensembler 绝不会替你挑选。
- **登录 Plex** —— 随后 Ensembler 会自动为你创建电视剧和电影
  媒体库。
- **完成 Overseerr** —— 它会用 Plex 登录并发现你的其他服务。

每个提示都带有一个 **打开** 链接，直接带你前往正确的位置。

使用 Jellyfin 或 Emby？它们不在这个列表中 —— Ensembler 会运行其容器，
但每个都自行管理其首次运行。从仪表盘中打开它，并在它自己的网页界面中
完成设置（创建管理员账户并添加你的媒体库）。

完成这些之后，你就正式启动运行了。

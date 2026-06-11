# Akasha — 云存储 Browser 项目规划（session）

> 项目代号 **Akasha（虚空系统）**：取「单一终端接通多个独立存储世界、并收录所见」之意象。
> 本文件用于在**新文件夹**启动一个新项目：一个 type 驱动、引擎即 model、可扩展的对象存储浏览器。
> 当前技术路线：**Bun + ElysiaJS + TypeScript**。项目按从头开始设计，不以迁移 Python/Flask 代码为主线。
> 末尾「参考信息」记录脱胎来源 `tos-browser` 的现状，仅供借鉴行为与协议事实。

---

## 目标

凭配置文件里的 `type` 字段决定调用哪个**引擎**；引擎作为 model/core 层，统一接口、独立实现、可注册扩展。新增一种存储 = 写一个引擎类 + 注册，不动上层。Web API、Web UI、CLI 共用同一套 core 抽象。

项目名 / 包名 / CLI 名：**`akasha`**。读感顺：`akasha browse genie:bucket/`、`akasha ls`、`akasha recall`。
（原 `tos-browser` 只是其中一个 S3 endpoint browser，弃用。）

---

## ★ 命名主题约定（Akasha 意象 · hack 风味）

**强制约定**：编码时类名、函数名、文件名、CLI 子命令尽量采用下表的 Akasha 意象命名，让代码本身带主题风味。
**唯一红线**：保持可读、不牺牲语义清晰；配置里的 `type` 值（`s3/oss/local/webdav`）和外部协议字段保持字面量，不改写。风味只加在「我们自己的」标识符上。

### 代码概念 → 意象命名映射

| 代码概念 | Akasha 命名 | 出处意象 |
|---|---|---|
| 项目 / 整体系统 | `akasha` | 虚空系统（连接并统一管理一切知识的网络） |
| 创造者（用于 trellis） | `Rukdvta` | 梵文原名 `Rukkhadevata` 的缩写 |
| CLI 入口 / 查询发起 | `terminal.ts` / `Terminal` | 虚空终端（Akasha Terminal，发起查询的设备） |
| 引擎抽象接口（StorageEngine） | `Darshan`（观法 / 学派基类） | 教令院六大学派，每种后端是一种「观看存储世界的法门」 |
| 具体引擎（S3/Local/WebDAV） | `S3Darshan` / `LocalDarshan` / `WebdavDarshan` | 各学派的具体观法 |
| 引擎注册表 / 工厂 | `Akademiya`（教令院） | 登记、调度各学派的机构 |
| 注册函数（register） | `enroll("s3", S3Darshan)`（入院注册） | 学派入教令院 |
| 取引擎（create_engine） | `Akademiya.summon(gnosis)`（召唤学派） | 按身份调取对应知识源 |
| 配置 / 凭据（RemoteConfig） | `Gnosis`（神之心） | 驱动虚空系统的核心权能，承载 key |
| 列表项数据类型（ObjectEntry） | `Capsule`（智识之种 / 知识胶囊） | Knowledge Capsule，封装的知识单元 |
| 索引存储（index_store） | `HouseOfWisdom`（智慧宫） | 教令院藏书阁，收录与借阅 |
| 索引落盘文件 | `irminsul.json`（世界树） | Irminsul，存储一切知识的根 |
| 能力声明（capabilities） | `clearance()`（权限等级） | 虚空按身份决定可取何种知识 |
| 必填字段（required_fields） | `requiredGnosis()` | 召唤该学派所需的核心权能 |
| 不支持异常（NotSupported） | `ForbiddenKnowledge`（禁忌知识） | 系统拒绝提供的知识 |
| 遍历 / 检索（iter_items） | `recall()` / `query()` | 向虚空发起回忆 / 查询 |
| 路径越界保护（normalize_root） | `seal()` / `purify()`（结界 / 净化） | 大慈树王净化污染、设界 |
| Elysia 服务上下文 | `Surasthana`（净善宫 / 圣所） | Sanctuary of Surasthana，系统所在之座 |

> 落地策略：保留 §4 的功能性目录骨架，类名/文件名按本表替换。如 `core/darshan.ts` 定义 `Darshan`、`Capsule`、`ForbiddenKnowledge`；`core/akademiya.ts` 定义 `Akademiya`；`service/house-of-wisdom.ts` 负责 `irminsul.json`。`type` 注册键仍是 `s3/local/webdav`。

### 周边意象词库（取名时备查）

源自原神须弥「虚空系统」体系（见文末 Sources），按用途分组，命名时就近取材：

- **系统 / 网络**：Akasha（虚空）、Akasha Terminal（虚空终端）、Irminsul（世界树 / 知识之根）、Ley Line（地脉）、Akashic Records（阿卡夏记录）。
- **机构 / 治理**：Akademiya（教令院）、House of Wisdom（智慧宫 / Bayt al-Hikmah）、Sanctuary of Surasthana（净善宫）、Grand Bazaar（集市）。
- **六大学派（Darshan，可作引擎/模块分类名）**：Amurta（生论派·生物）、Spantamad（素论派·元素）、Haravatat（妙论派·语言）、Kshahrewar（工巧派·工程）、Vahumana（因论派·心理史学）、Rtawahist（知论派·天文占星）。
- **知识单元 / 数据**：Knowledge Capsule（智识之种）、Divine Knowledge Capsule（神圣智识之种）、Dream（梦 / 借取的梦）、Satyavada（真理 / 旧名）。
- **权能 / 凭据**：Gnosis（神之心）、Clearance（权限等级）、Vision（神之眼）。
- **守护 / 角色**：Rukkhadevata（大慈树王 / 旧草神）、Nahida·Kusanali（纳西妲 / 现草神）、Katheryne（图书管理员卡塔扬，对应「管理员/索引维护」语义）。
- **威胁 / 错误语义**：Forbidden Knowledge（禁忌知识 → 异常/拒绝）、Withering（枯萎 → 损坏/失效）、Defilement（污染 → 校验失败）、Eleazar（病症 → 超时/重试耗尽）。

---

## 1. 技术路线

主栈：

- Runtime / package manager / test runner：**Bun**
- API framework：**ElysiaJS**
- Language：**TypeScript**
- API contract：Elysia schema + OpenAPI；前端/测试可用 Eden typed client
- CLI：Bun executable + 同一套 core service
- S3 SDK：AWS SDK for JavaScript v3（`@aws-sdk/client-s3`、`@aws-sdk/s3-request-presigner`）
- 配置解析：INI parser，保持 rclone.conf 兼容
- 索引落盘：JSON 文件，默认 `irminsul.json`

核心原则：

1. **Elysia 只做 server adapter**：`server/` 不允许承载存储业务规则。
2. **core 框架无关**：`core/`、`engines/`、`service/` 不依赖 Elysia。
3. **CLI 与 Web 共用 service**：命令行和 HTTP API 不复制浏览、路径、索引逻辑。
4. **schema 双层校验**：Elysia 校验外部请求；core 校验配置和引擎能力。

---

## 2. 分层架构

```
interface 层   server/（ElysiaJS） / cli/（Bun CLI） / frontend/（可选）
   ↓ 只依赖 service 与 Darshan 抽象
service 层     browsing 逻辑、路径规整、能力判断、index 落盘
   ↓
core/model 层  Darshan 抽象 + Capsule/Gnosis/Akademiya
   ↓
engines 层     S3Darshan / LocalDarshan / WebdavDarshan
   ↓
config 层      解析 rclone.conf → Gnosis(type, raw)
```

硬约束：interface 层只调用 service/core 抽象，对 s3/local/webdav 一无所知。所有后端差异封死在 engines 层内。

---

## 3. 核心抽象（core/model 层）

### 3.1 统一数据模型

通用 `Capsule`：

```ts
export interface Capsule {
  key: string
  name: string
  isDir: boolean
  size?: number
  lastModified?: string
  etag?: string
  storageClass?: string
  extra?: Record<string, unknown>
}
```

### 3.2 引擎接口

```ts
export interface Darshan {
  readonly typeName: string

  listObjects(bucket: string, prefix?: string, delimiter?: string): Promise<Capsule[]>
  stat(bucket: string, key: string): Promise<Record<string, unknown>>
  readBytes(bucket: string, key: string, maxBytes?: number): Promise<Uint8Array>
  download(bucket: string, key: string, dest: string): Promise<string>
  uploadFile(bucket: string, source: Blob | Uint8Array | ReadableStream, key: string): Promise<string>
  delete(bucket: string, key: string): Promise<void>

  listBuckets?(): Promise<string[]>
  presign?(bucket: string, key: string, options?: PresignOptions): Promise<string>
  clearance(): Set<DarshanCapability>
}

export type DarshanCapability =
  | "list_buckets"
  | "read"
  | "download"
  | "upload"
  | "delete"
  | "presign"
```

`clearance()` 解决「不同后端能力不齐」：前端和 CLI 按引擎声明的能力决定是否显示或启用「预览/删除/上传」按钮，不靠 try/catch 探测功能。

### 3.3 注册机制（可扩展核心）

```ts
type DarshanCtor = {
  typeName: string
  requiredGnosis(): Set<string>
  new (gnosis: Gnosis): Darshan
}

export class Akademiya {
  private readonly registry = new Map<string, DarshanCtor>()

  enroll(...ctors: DarshanCtor[]): void {
    for (const ctor of ctors) this.registry.set(ctor.typeName, ctor)
  }

  summon(gnosis: Gnosis): Darshan {
    const ctor = this.registry.get(gnosis.type)
    if (!ctor) throw new ForbiddenKnowledge(`Unknown type: ${gnosis.type}`)
    validateRequiredGnosis(gnosis, ctor.requiredGnosis())
    return new ctor(gnosis)
  }
}
```

用户写新引擎：实现 `Darshan` + 暴露 `requiredGnosis()` + 在 engine index 中 `enroll`。上层无需改动。

---

## 4. 配置层

保持 rclone.conf 兼容（INI + `type`），但**不在 config 层硬取 S3 字段**。字段解释权下放给引擎，这是支持任意后端的前提：

```ts
export interface Gnosis {
  name: string
  type: string
  raw: Record<string, string>
}
```

S3Darshan 从 `raw` 取 `access_key_id / secret_access_key / endpoint / region / force_path_style`；WebdavDarshan 从 `raw` 取 `url / user / pass`；LocalDarshan 从 `raw` 取 `root`。互不干扰。

rclone 对密码/token 类字段做了 obscure 混淆，不是明文。密码型后端需实现 reveal 解混淆，或在 MVP 明确要求用户填明文。

---

## 5. 目录结构

```
src/
  core/
    capsule.ts              # Capsule 数据模型
    darshan.ts              # Darshan 接口、能力类型、ForbiddenKnowledge
    gnosis.ts               # Gnosis 类型与配置校验
    akademiya.ts            # 注册表 / 工厂
  engines/
    index.ts                # enroll 内置引擎
    s3.ts                   # S3Darshan（覆盖 s3/tos/oss/cos/minio/r2）
    local.ts                # LocalDarshan（本地目录，零网络测试用）
    webdav.ts               # WebdavDarshan（扩展阶段）
  service/
    browser.ts              # 浏览用例、bucket/prefix 解析
    house-of-wisdom.ts      # 目录快照落盘 JSON
    path.ts                 # seal/purify 路径规整与越界保护
  server/
    app.ts                  # Elysia app 创建
    routes.ts               # HTTP routes
    schemas.ts              # Elysia/t schema
    surasthana.ts           # Web 服务上下文
  cli/
    terminal.ts             # Bun CLI 入口
    commands.ts             # remotes/buckets/ls/cat/get/put/rm/url/browse
  frontend/                 # 可选：Web UI
  index.ts                  # library exports
```

---

## 6. Elysia API 设计

Elysia 负责 HTTP 边界、schema 校验、OpenAPI、typed client，不承载后端差异。

建议路由：

| Method | Route | 用途 |
|---|---|---|
| `GET` | `/api/remotes` | 列出 rclone.conf 中的 remotes |
| `GET` | `/api/buckets` | 列出当前 remote 的 buckets（能力存在时） |
| `GET` | `/api/objects` | 按 `remote/bucket/prefix` 列目录 |
| `GET` | `/api/object/stat` | 查看对象元信息 |
| `GET` | `/api/object/read` | 小文件预览 / 读取前 N bytes |
| `GET` | `/api/object/url` | 获取预签名 URL（能力存在时） |
| `POST` | `/api/object/upload` | 上传文件 |
| `DELETE` | `/api/object` | 删除对象 |
| `POST` | `/api/index/recall` | 刷新当前目录索引 |
| `GET` | `/api/index` | 读取已落盘索引 |

Elysia 层返回统一错误结构：

```ts
export interface AkashaError {
  code: "forbidden_knowledge" | "invalid_gnosis" | "not_found" | "backend_error"
  message: string
  detail?: unknown
}
```

---

## 7. 引擎实现清单

| 阶段 | 引擎 | type | 依赖 | 说明 |
|------|------|------|------|------|
| MVP | `S3Darshan` | `s3` | AWS SDK JS v3 | 一个引擎覆盖 S3/TOS/OSS/COS/MinIO/R2（都走 S3 兼容） |
| MVP | `LocalDarshan` | `local` | Bun/Node fs API | 本地文件系统，验证抽象是否干净、无网测试 |
| 扩展 | `WebdavDarshan` | `webdav` | 待选 WebDAV client 或 fetch 自实现 | 坚果云等 |
| 扩展 | `OssNativeDarshan` | `oss` | 阿里云 OSS JS SDK | 仅当需要 S3 兼容层缺的 OSS 专有特性时才做 |

**关键判断**：OSS/COS 暂不需要独立引擎，S3Darshan 应先覆盖。仅当某后端特性 S3 兼容层给不了时，才落地原生 SDK 引擎。

---

## 8. 关键设计决策

1. **Web-first，但 core-first 实现**：Elysia 是第一 HTTP 框架，但业务核心必须先在 `core/service/engines` 成型。
2. **S3 兼容优先，原生 SDK 兜底**：一个 S3Darshan 覆盖绝大多数云厂商，原生引擎按需补。
3. **能力声明而非异常驱动**：`clearance()` 让 UI/CLI 提前知道哪些操作不可用。
4. **配置字段下放**：config 层不认识任何后端字段，全交给引擎。
5. **自动注册**：`engines/index.ts` 汇总内置引擎，加引擎只改该文件或插件入口。
6. **不内嵌 rclone 二进制**：自己实现引擎，可控、无外部进程依赖。
7. **Eden/OpenAPI 输出是 API 契约**：Web UI、测试与第三方调用优先依赖类型化接口。

---

## 9. 里程碑

- **M1 项目骨架与抽象落地**：Bun + TypeScript + Elysia 初始化；实现 `Darshan`、`Capsule`、`Gnosis`、`Akademiya`、`ForbiddenKnowledge`；补 core 单测。
- **M2 LocalDarshan + CLI 验证**：实现本地文件系统引擎，跑通 `akasha ls local:root/`、`akasha recall`，证明上层不依赖 S3。
- **M3 S3Darshan**：接入 AWS SDK JS v3，覆盖 TOS/OSS/COS/MinIO/R2 的 S3 兼容 profile；实现 list/read/download/upload/delete/presign。
- **M4 Elysia API**：实现 `server/app.ts`、routes、schema、OpenAPI；Web 与 CLI 共用 service。
- **M5 Web UI**：基于 Elysia typed client 做浏览、预览、下载、删除、上传、索引查看。
- **M6 异类后端**：实现 `WebdavDarshan` 验证非 S3 路径，沉淀「写一个新引擎」开发文档。

---

## 10. 风险点

- **AWS SDK JS v3 比 boto3 啰嗦**：封装在 S3Darshan 内，不让 service 层接触 SDK command。
- **Bun 与部分 Node 包兼容性**：MVP 优先使用 Web 标准、AWS SDK、Bun fs；引入冷门依赖前先做 spike。
- **接口抽象粒度**：bucket/key 概念对 WebDAV/本地不自然。对策：抽象层用 `bucket + prefix/key`，非 bucket 后端把根目录映射成单一虚拟 bucket。
- **presign 不通用**：本地/WebDAV 无预签名。对策：能力缺失时 service 层回退为服务端中转下载，而非报错。
- **认证多样性**：OAuth（GDrive）型后端需 token 刷新，和 key 型差异大。对策：先只做 key/密码型，OAuth 留到接口稳定后再加凭据刷新钩子。
- **rclone obscure 兼容**：密码型后端需 reveal 算法。MVP 可只支持明文或 S3 access key，扩展阶段补齐。

---

# 参考信息：来源项目 `tos-browser` 现状

> 路径：`./archive/refer-tos-browser/`
> 新项目不以迁移 Python/Flask 为目标，但可参考其行为、参数、索引格式与 S3 兼容事实。

## A. 它是什么

CLI + Web 浏览火山引擎 TOS（S3 兼容对象存储）的工具。凭据复用 rclone 的 S3 profile。
本质是**通用 S3v4 客户端**，「TOS」仅存在于命名和文案，不在协议层。

## B. 现有文件与职责（参考映射）

| 来源文件 | 职责 | TypeScript 新项目参考去向 |
|------|------|----------|
| `src/tos_browser/client.py` | `TosClient`：boto3 S3 封装 | → `engines/s3.ts` 的 `S3Darshan` |
| `src/tos_browser/config.py` | 解析 rclone.conf，`RemoteConfig` 数据类 | → `core/gnosis.ts` + config parser |
| `src/tos_browser/web.py` | Flask app、目录导航、预览、下载、删除、上传 | → `server/` + `service/browser.ts` |
| `src/tos_browser/cli.py` | 子命令 `remotes/buckets/ls/cat/get/put/rm/url/browse` | → `cli/terminal.ts` |
| `src/tos_browser/index_store.py` | 目录快照落盘 JSON，`IndexStore.iter_items()` 预留遍历入口 | → `service/house-of-wisdom.ts` |
| `main.py` | Web 启动入口 | → Bun script / `src/server/app.ts` |

## C. 关键技术事实（已验证）

1. **数据访问层与厂商无关**：来源项目只发标准 S3v4 请求，endpoint/region/force_path_style 全从配置继承。
2. **OSS / COS 零改动可用**：两家提供 S3 兼容接口，rclone 体系里也是 `type = s3` 下的 provider。当前代码忽略 `provider` 字段，只取 key/endpoint/region 即能连。
   - OSS：`endpoint=https://oss-cn-hangzhou.aliyuncs.com`，`region=cn-hangzhou`，`force_path_style=false`（必须 virtual-host）。
   - COS：`endpoint=https://cos.ap-guangzhou.myqcloud.com`，`region=ap-guangzhou`，bucket 名带 APPID 后缀如 `mybucket-1250000000`。
3. **旧 config 层只认 S3 字段**：非 S3 的 rclone section（sftp/webdav/drive/b2/crypt）解析出来字段为空，连不上。新项目必须用「字段下放给引擎」解决。

## D. rclone.conf 各后端形态（新 config 层要兼容的输入样本）

```ini
# S3 兼容（TOS/OSS/COS/MinIO/R2），access key 明文
[genie]
type = s3
access_key_id = AKLT...
secret_access_key = ...
endpoint = https://tos-s3-cn-shanghai.volces.com
region = cn-shanghai
force_path_style = false

# SFTP（pass 经 rclone obscure 混淆，非明文）
[myserver]
type = sftp
host = 192.168.1.10
user = wkyuu
pass = xxxxx_obscured_xxxxx

# WebDAV（坚果云）
[nutstore]
type = webdav
url = https://dav.jianguoyun.com/dav/
vendor = other
user = a@b.com
pass = xxxxx_obscured_xxxxx

# Google Drive（OAuth，token 为 JSON，需刷新，M6 之后再支持）
[gdrive]
type = drive
token = {"access_token":"ya29...","refresh_token":"1//...","expiry":"..."}

# crypt（嵌套在别的 remote 之上）
[secret]
type = crypt
remote = gdrive:vault
password = xxxxx_obscured_xxxxx
```

注意点：rclone 对密码/token 类字段做了 obscure 混淆，不是明文；S3 的 access key 是明文。若要全面兼容 rclone.conf，密码型后端需实现 rclone 的 reveal 解混淆，或要求用户填明文。

## E. 索引落盘结构

每进入一个目录，把该目录直接子项快照写入 `--index` JSON（默认 `./irminsul.json`），重入原地更新：

```json
{
  "version": 1,
  "directories": {
    "aidea-ota/fota": {
      "path": "aidea-ota/fota",
      "bucket": "aidea-ota",
      "prefix": "fota/",
      "first_indexed_at": "2026-06-11T03:14:52+00:00",
      "indexed_at": "2026-06-11T03:20:01+00:00",
      "item_count": 12,
      "items": [
        {
          "name": "a2d_v101.bin",
          "path": "aidea-ota/fota/a2d_v101.bin",
          "type": "file",
          "size": 136304,
          "modified": "2025-02-24 08:58:36+00:00"
        }
      ]
    }
  }
}
```

`first_indexed_at` 重入保留，`indexed_at` 每次刷新；item 是普通对象，可直接追加字段无需迁移。

## F. 来源项目依赖与运行（仅作参考）

- 包管理：`uv`（`uv sync` / `uv run`）。
- 运行依赖：`boto3` / `botocore`（S3）、`flask`（Web）。
- Web 启动：`uv run main.py /path/to/rclone.conf --path my-bucket` → `http://127.0.0.1:8000/`。
- Web 功能：面包屑导航、点击文件预览（新标签页预签名直链）、下载、删除、当前目录上传；下载/预览走预签名 URL 不经服务中转。

---

## Sources（意象词库来源）

- [Akasha System — Genshin Impact Wiki (Fandom)](https://genshin-impact.fandom.com/wiki/Akasha_System)
- [Category:Sumeru Terminology — Genshin Impact Wiki](https://genshin-impact.fandom.com/wiki/Category:Sumeru_Terminology)
- [须弥教令院 — 萌娘百科](https://zh.moegirl.org.cn/zh-hans/%E9%A1%BB%E5%BC%A5%E6%95%99%E4%BB%A4%E9%99%A2)
- [须弥 (原神) — 维基百科](https://zh.wikipedia.org/zh-cn/%E9%A1%BB%E5%BC%A5_(%E5%8E%9F%E7%A5%9E))
- [《原神》须弥教令院NPC职能构架介绍 — 游民星空](https://www.gamersky.com/handbook/202210/1531626.shtml)

# Design — 画像ファイルビューア

本ドキュメントはアプリケーションの実装詳細を記述する。機能要件は [Spec.md](./Spec.md) を参照。

## ディレクトリ構成

```
app/
├── components/
│   └── media-viewer.tsx       # メディアビューア（ライトボックス）コンポーネント
├── db/
│   ├── client.server.ts       # SQLite接続・テーブル初期化
│   ├── queries.server.ts      # Drizzle ORMクエリ関数群
│   └── schema.server.ts       # Drizzleスキーマ定義
├── routes/
│   ├── auth.google.tsx        # Google OAuth2 認証開始
│   ├── auth.google.callback.tsx # OAuth2 コールバック処理
│   ├── browse.tsx             # ギャラリー（サムネイル一覧）ページ
│   ├── db.tsx                 # アカウント・マッピング管理画面
│   ├── index.tsx              # ホーム（ダッシュボード）
│   ├── login.tsx              # ログイン画面
│   ├── logout.tsx             # ログアウト処理
│   ├── media.tsx              # オリジナルメディア配信
│   └── thumb.tsx              # サムネイル配信
├── services/
│   ├── auth.server.ts         # Authenticator設定・認証ヘルパー
│   ├── gallery.server.ts      # ファイルシステム操作・サムネイル生成
│   ├── media.server.ts        # ファイルレスポンス生成
│   └── session.server.ts      # Cookieセッション管理
├── utils/
│   └── url-path.server.ts     # URLパス正規化・予約パス判定
├── app.css                    # Tailwind CSS エントリポイント
├── root.tsx                   # Reactルートレイアウト
└── routes.ts                  # ルーティング定義
```

## ルーティング

`routes.ts` で全ルートを定義する。React Router フレームワークモードを利用。

| パス | ファイル | 用途 |
|---|---|---|
| `/` | `index.tsx` | ホーム画面。利用可能なディレクトリ一覧を表示 |
| `/login` | `login.tsx` | ログイン画面 |
| `/logout` | `logout.tsx` | ログアウト（POSTでセッション破棄、GETはリダイレクト） |
| `/auth/google` | `auth.google.tsx` | OAuth2認証開始 |
| `/auth/google/callback` | `auth.google.callback.tsx` | OAuth2コールバック |
| `/db` | `db.tsx` | 管理画面（ユーザ・マッピングCRUD） |
| `/media` | `media.tsx` | オリジナルメディア配信（`?base=&path=`） |
| `/thumb` | `thumb.tsx` | サムネイル配信（`?base=&path=`） |
| `/*` | `browse.tsx` | ギャラリー表示（キャッチオールルート） |

## 認証

### フロー

```
/login → /auth/google → Google OAuth2 → /auth/google/callback → / (ホーム)
```

1. `auth.google.tsx` の `loader` で `authenticator.authenticate("google", request)` を呼び、Google OAuth2の認可エンドポイントへリダイレクト
2. Google認証後、`auth.google.callback.tsx` でアクセストークンからユーザプロファイル（email）を取得
3. Cookieセッション (`photo_viewer_session`) に `user` を保存して `/` にリダイレクト

### 認可チェック

`requireAuthorizedUser(request)` が全保護ルートの入口。

- セッションに `user` がなければ `/login` へリダイレクト
- `users` テーブルが空の場合は誰でもアクセス可能（初期セットアップ用）
- テーブルにレコードがある場合、該当emailが登録されていなければセッションを破棄し `/login?error=unauthorized` へリダイレクト

### セッション

`session.server.ts` で `createCookieSessionStorage` を利用。

- Cookie名: `photo_viewer_session`
- `httpOnly: true`, `sameSite: "lax"`
- 本番環境のみ `secure: true`
- `VITE_SESSION_SECRET` 環境変数が必須

## データベース

### 初期化

`client.server.ts` で `better-sqlite3` を直接利用し、`data/app.db` に接続。起動時に `CREATE TABLE IF NOT EXISTS` で自動的にテーブルを作成する。WALモードを有効化。

### Drizzle ORM スキーマ

`schema.server.ts` に定義。

```typescript
// users テーブル
users: { id: integer (PK, auto), email: text (NOT NULL) }

// mappings テーブル
mappings: { id: integer (PK, auto), userId: integer (FK → users.id, NOT NULL),
            urlPath: text (NOT NULL), directory: text (NOT NULL) }
```

### クエリ関数 (`queries.server.ts`)

| 関数 | 説明 |
|---|---|
| `listUsers()` | 全ユーザをemail順で取得 |
| `countUsers()` | ユーザ数を取得（初期状態判定用） |
| `getUserByEmail(email)` | emailでユーザを検索 |
| `createUser(email)` | ユーザをlowercaseで追加 |
| `deleteUser(userId)` | ユーザとその全マッピングをカスケード削除 |
| `listMappings()` | 全マッピングをurlPath順で取得 |
| `listMappingsForUser(userId)` | 特定ユーザのマッピング一覧 |
| `createMapping(params)` | マッピングを追加 |
| `deleteMapping(mappingId)` | マッピングを削除 |
| `getMappingByUserAndPath(userId, urlPath)` | ユーザIDとurlPathの完全一致でマッピング取得 |

## ギャラリー (browse.tsx)

### URLパスとディレクトリの対応

キャッチオールルート (`/*`) として動作。`matchMapping` 関数でリクエストパスを `mappings` テーブルと照合し、最長一致する `urlPath` のマッピングを選択する。

```
例: mappings に /photos → /mnt/photos がある場合
リクエスト /photos/vacation → ディスク /mnt/photos/vacation を表示
```

### セキュリティ

- `normalizeRelativePath()` で相対パスを正規化。絶対パスや `..` によるディレクトリトラバーサルを拒否
- `ensureWithinRoot()` で解決後のパスがマッピングのルートディレクトリ内であることを検証
- シンボリックリンクを一律拒否（`lstat` で判定）

### ディレクトリ一覧の構築

`listDirectoryEntries()` で `.thumbs` ディレクトリとシンボリックリンクを除外した上で、エントリを以下に分類:

- **フォルダ**: サブディレクトリ → `folders` 配列
- **メディアファイル**: 対応拡張子を持つ通常ファイル → `files` 配列

各メディアファイルには `thumbUrl` (`/thumb?base=...&path=...`) と `fileUrl` (`/media?base=...&path=...`) を生成。サムネイルが存在しない場合は `ensureThumbnail()` で即時生成する。

### 対応メディア形式

| 種別 | 拡張子 |
|---|---|
| 画像 | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.tif`, `.tiff`, `.avif` |
| 動画 | `.mp4`, `.mov`, `.m4v`, `.avi`, `.mkv`, `.webm`, `.mpeg`, `.mpg`, `.wmv`, `.flv` |

## サムネイル生成 (gallery.server.ts)

### 画像サムネイル

`sharp` を使用。横幅320pxにリサイズし、アスペクト比を維持。

保存先: `<元ファイルのディレクトリ>/.thumbs/<元ファイル名>`

### 動画サムネイル

`ffmpeg` を使用。動画の2秒時点のフレームをJPEGとして抽出。2秒未満の動画の場合は先頭フレームにフォールバック。

保存先: `<元ファイルのディレクトリ>/.thumbs/<拡張子をjpgに変更したファイル名>`

### キャッシュ戦略

サムネイルは `.thumbs` ディレクトリに永続保存される。`ensureThumbnail()` はまず `fs.access()` でサムネイルの存在を確認し、存在する場合はスキップする。

## メディア配信 (media.tsx, thumb.tsx)

`media.tsx` と `thumb.tsx` はいずれもloader専用のルート（UIなし）。

1. `requireAuthorizedUser()` で認証チェック
2. `base` と `path` クエリパラメータを取得
3. `getMappingByUserAndPath()` で当該ユーザが `base` パスへのアクセス権を持つか検証
4. `normalizeRelativePath()` + `ensureWithinRoot()` でパストラバーサルを防止
5. `createFileResponse()` で `Content-Type` と `Content-Length` を設定したストリーミングレスポンスを返す

`createFileResponse()` は `fs.createReadStream()` で読み取ったストリームを `createReadableStreamFromReadable()` でWeb標準の `ReadableStream` に変換する。MIMEタイプは `mime-types` パッケージで判定。

## メディアビューア (media-viewer.tsx)

### 概要

サムネイルクリック時にフルスクリーンのライトボックスオーバーレイを表示する。ビューアは `browse.tsx` 内の `viewerIndex` ステート（`number | null`）で制御し、`null` のとき非表示。

### ナビゲーション

同一ディレクトリ内のメディアファイル間を移動可能。以下の操作に対応:

| 操作 | 前へ | 次へ | 閉じる |
|---|---|---|---|
| タッチスワイプ | 右へスワイプ | 左へスワイプ | — |
| マウスドラッグ | 右へドラッグ | 左へドラッグ | — |
| ボタン | ‹ ボタン | › ボタン | ✕ ボタン |
| キーボード | ← | → | Escape |
| 背景クリック | — | — | ○ |

スワイプ閾値は50px。先頭ファイル表示時は「前へ」操作が無効化、末尾ファイル表示時は「次へ」操作が無効化される（循環しない）。

### 表示

- 画像: `<img>` 要素で表示。`object-contain` で最大 `85vh × 90vw` に収める
- 動画: `<video>` 要素で表示。`controls` と `autoPlay` を有効化
- ビューアオープン中は `body` のスクロールをロック

## 管理画面 (db.tsx)

`/db` パスは特別扱いとし、マッピングの `urlPath` に `/db` を設定することを禁止している (`isReservedPath`)。

### loader

全ユーザ・全マッピングを取得し、現在のユーザの登録状態とともに返す。

### action

`_action` フォームフィールドで操作を判別:

| `_action` | 動作 |
|---|---|
| `add-user` | emailでユーザ追加 |
| `delete-user` | ユーザと関連マッピングを削除 |
| `add-mapping` | URLパスとディレクトリの対応を追加。パスの正規化、予約パスチェック、ディレクトリの実在確認を実施 |
| `delete-mapping` | マッピングを削除 |

## 環境変数

`.env` ファイルで管理。以下が必須:

| 変数 | 用途 |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth2 クライアントID |
| `VITE_GOOGLE_CLIENT_SECRET` | Google OAuth2 クライアントシークレット |
| `VITE_GOOGLE_CALLBACK_URL` | OAuth2コールバックURL |
| `VITE_SESSION_SECRET` | Cookieセッションの署名シークレット |

## デプロイ

ベアメタルサーバ上の Node.js で動作。`react-router-serve` を利用。

```bash
npm run build          # ビルド
npm run start          # 本番起動 (react-router-serve ./build/server/index.js)
```

前提条件:
- Node.js がインストール済み
- FFmpeg がインストール済み（動画サムネイル生成に必要）
- `data/` ディレクトリにSQLiteデータベースが自動生成される

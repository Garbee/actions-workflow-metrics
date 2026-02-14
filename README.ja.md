# actions-workflow-metrics

<!-- textlint-disable ja-technical-writing/ja-no-mixed-period -->

[English](README.md) | 日本語

<!-- textlint-enable ja-technical-writing/ja-no-mixed-period -->

ワークフロー実行中にシステムメトリクスを収集し、Mermaidチャートを出力するGitHub Actionsです。

## 機能

- **システムメトリクス収集**: ワークフロー実行中のCPU負荷とメモリ使用量をリアルタイムで収集
- **ステップレベルの可視化**: 個別のワークフローステップごとのメトリクスを追跡・可視化
- **Mermaidチャート生成**: 収集したメトリクスをステップアノテーション付きのMermaid形式の積み上げ棒グラフとして可視化
- **ジョブサマリー出力**: GitHub Actionsのジョブサマリーにチャートとステップタイムラインを自動的に表示

## 出力例

次のようなチャートやデータが出力されます。

### CPU Loads

システム/ユーザーCPU負荷の積み上げ棒グラフです。

![CPU Loads](images/metrics_example_cpu.png)

### Memory Usages

使用中/空きメモリの積み上げ棒グラフです。

![Memory Usages](images/metrics_example_memory.png)

### Artifacts

CPU LoadsやMemory UsagesのJSONデータです。

![Artifacts](images/artifact_example.png)

## 使い方

このアクションはワークフローの**先頭**で実行することを前提としています。

### 基本的な使い方

```yaml
name: Example Workflow

on: [push]

jobs:
  example:
    runs-on: ubuntu-latest
    steps:
      # ワークフローの先頭でactions-workflow-metricsを実行
      - name: Start Workflow Telemetry
        uses: dev-hato/actions-workflow-metrics@v1

      # 以降の通常のステップ
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run tests
        run: npm test

      # ... その他のステップ
```

### 高度な使い方: ステップレベルの追跡

#### オプション1: 自動ステップ検出（推奨）

GitHub APIから自動的にステップ情報を取得するため、GitHubトークンを提供します:

```yaml
- name: Start Workflow Telemetry
  uses: dev-hato/actions-workflow-metrics@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

これにより、メトリクスがワークフローステップと自動的に関連付けられ、次の情報が表示されます:

- 開始/終了時刻と実行時間を含むステップサマリーテーブル
- チャート上のステップタイムラインアノテーション

#### オプション2: 手動ステップマーカー

より正確な制御のため、ステップの境界を手動でマークします:

```yaml
- name: Start Workflow Telemetry
  uses: dev-hato/actions-workflow-metrics@v1

- name: Build Project
  run: |
    curl -X POST http://localhost:7777/mark-step \
      -H "Content-Type: application/json" \
      -d '{"stepName":"Build Project","status":"start"}'

    npm run build

    curl -X POST http://localhost:7777/mark-step \
      -H "Content-Type: application/json" \
      -d '{"stepName":"Build Project","status":"end"}'

- name: Run Tests
  run: |
    curl -X POST http://localhost:7777/mark-step \
      -H "Content-Type: application/json" \
      -d '{"stepName":"Run Tests","status":"start"}'

    npm test

    curl -X POST http://localhost:7777/mark-step \
      -H "Content-Type: application/json" \
      -d '{"stepName":"Run Tests","status":"end"}'
```

### 設定オプション

| 入力               | 説明                                           | 必須   | デフォルト |
| ------------------ | ---------------------------------------------- | ------ | ---------- |
| `interval_seconds` | メトリクス収集の間隔（秒）                     | いいえ | `5`        |
| `github-token`     | ワークフローステップ情報取得用のGitHubトークン | いいえ | -          |

### 実行フロー

1. **main** (ワークフロー開始時): バックグラウンドでメトリクス収集サーバーを起動
2. **ワークフローの各ステップ**: 通常通り実行されながらバックグラウンドでメトリクスが収集される
3. **post** (ワークフロー終了時): ステップ情報を取得し（トークンが提供された場合）、収集したメトリクスをステップアノテーション付きのMermaidチャートとして描画し、ジョブサマリーに出力

## 技術スタック

- **Node.js**: 24.x
- **TypeScript**: 5
- **パッケージマネージャー**: Bun
- **主要ライブラリ**:
  - `systeminformation`: システムメトリクス収集
  - `zod`: スキーマバリデーション
  - `@actions/core`: GitHub Actions連携
  - `@actions/github`: ステップ情報取得のためのGitHub API連携

## 開発セットアップ

### 1. 依存関係のインストール

```bash
bun install
```

### 2. pre-commitのセットアップ（推奨）

セキュリティのため、[pre-commit](https://pre-commit.com/)をインストールしてください。コミット時にクレデンシャルが含まれていないか自動チェックされます。

```bash
# macOSの場合
brew install pre-commit

# またはpipを使用
pip install pre-commit

# pre-commitフックをインストール
pre-commit install
```

これにより、コミット時に自動的にgitleaksが実行されます。
APIキーやトークンなどの機密情報が含まれていないかチェックされます。

## 開発コマンド

```bash
# 型チェック + バンドル（dist/ディレクトリに出力）
bun run build

# ユニットテストの実行（Bunテストランナー）
bun test

# コードフォーマット（Prettier）
bun run fix
```

## プロジェクト構成

```text
src/
├── lib.ts                 # 共通スキーマとサーバー設定
├── main/
│   ├── index.ts           # mainエントリーポイント（サーバー起動）
│   ├── server.ts          # メトリクス収集HTTPサーバー
│   ├── metrics.ts         # Metricsクラス（メトリクス管理）
│   └── metrics.test.ts    # Metricsクラスのテスト
└── post/
    ├── index.ts           # postエントリーポイント（ジョブサマリー出力）
    ├── lib.ts             # メトリクスフェッチとレンダリング
    ├── lib.test.ts        # レンダリングロジックのテスト
    ├── renderer.ts        # Mermaidチャート生成
    └── renderer.test.ts   # Mermaidチャート生成のテスト
```

## アーキテクチャ

### main実行時

1. `src/main/index.ts`が実行される
2. Node.jsで`src/main/server.ts`をデタッチドプロセスとして起動
3. サーバーが`localhost:7777`でメトリクスJSONを配信開始。エンドポイント:
   - `GET /metrics`: 収集したメトリクスデータを返す
   - `POST /mark-step`: 手動ステップマーカーを受け付ける
   - `GET /finish`: サーバーをシャットダウン
4. `Metrics`クラスが5秒ごとに`systeminformation`ライブラリを使ってCPU/メモリ情報を収集

### post実行時

1. `src/post/index.ts`が実行される
2. `localhost:7777`からメトリクスJSONを取得（タイムアウト： 10秒）
3. GitHub APIからワークフローステップ情報を取得（トークンが提供された場合）
4. API由来のステップ情報と手動マーカーをマージ（手動マーカーが優先）
5. `Renderer`クラスがステップアノテーション付きのMermaidチャートを生成
6. `@actions/core`の`summary` APIでジョブサマリーに出力。出力内容:
   - 実行時間を含むステップサマリーテーブル
   - ステップタイムラインアノテーション付きのCPUとメモリチャート

## ライセンス

[MIT License](LICENSE)

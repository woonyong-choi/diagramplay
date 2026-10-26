<h1 align="center">DiagramPlay</h1>

<p align="center">
  A documentation diagram tool that draws structure, flows, and value changes from text<br>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <a href="https://github.com/woonyong-choi/diagramplay/actions/workflows/ci.yml"><img src="https://github.com/woonyong-choi/diagramplay/actions/workflows/ci.yml/badge.svg" alt="CI"></a><br>
  <a href="README.md">한국어</a> | English
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/showcase/async-orders-en-dark.svg">
    <img src="docs/assets/showcase/async-orders-en-light.svg" alt="Synthetic data: orders from four sources enter an event queue and reach inventory, payment, and notification consumers as the queue fills and one email is lost">
  </picture>
</p>

DiagramPlay lays out elements and connections from a text source and turns timed movement and value changes into SVG and HTML. The demos in this repository use synthetic data.

## Quick start

Node.js 20 or later and Git are required. Run from source before the npm release.

```sh
git clone https://github.com/woonyong-choi/diagramplay.git
cd diagramplay
npm ci
cat > request.diagramplay <<'EOF'
diagramplay
box client "Client"
box server "Server"
client -> server "GET /orders"
scene "Request"
  client -> server
EOF
node src/cli.js render request.diagramplay --html
```

The command reads the request flow in `request.diagramplay` and creates two files in the current directory.

```text
request.svg
request.html
```

Open `request.html` in a browser to see a dot move from Client to Server. You can embed the SVG as an image in a document.

To write your own source, read [Create your first figure](docs/usage.md#첫-그림-만들기). To embed it in Markdown, read [Document embedding](docs/usage.md#markdown과-홈페이지에-넣기). [CLI output and checks](docs/usage.md#cli-출력과-검사) covers command options and diagnostics.

## Why

To explain request movement and value changes in documentation, you need to show structure and execution order together. DiagramPlay lets you describe elements such as boxes and their connections in text, then add scenes with timed actions to the same figure. One source can combine structure, sequences, states, data relations, and charts.

A graphic editor is a better fit when you want to edit the layout and shapes of a static diagram directly. DiagramPlay is for text-based documentation that plays flows and value changes.

## How it works

1. Write elements and connections in a `.diagramplay` file, then add movement and value changes in scenes.
2. DiagramPlay checks the source, measures text to lay out the elements, and builds a timeline for the scenes.
3. SVG plays one scene, and HTML lets readers select scenes through tabs.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/how-it-works-dark.svg">
  <img src="docs/assets/how-it-works-light.svg" alt="Synthetic data: a developer's question moves from Screen through Engine to Codex CLI">
</picture>

This question delivery example uses synthetic data. Read the [source](docs/assets/how-it-works.diagramplay) alongside the [processing flow](docs/architecture.md#처리-흐름). [Choose a view for your task](docs/usage.md#목적에-맞는-보기-선택하기) explains which diagram type to use.

## Status

The existing [GitHub Releases](https://github.com/woonyong-choi/diagramplay/releases) predate the project rename. The current instructions use the source in this repository.

DiagramPlay supports SVG and HTML generation, Markdown figure updates, GitHub Action checks, a JavaScript API, and external diagram imports. [Supported expressions](docs/design/expression-coverage.md#지원하는-표현) lists features and examples by diagram type.

Remaining work is tracked in [visual defects before release #364](https://github.com/woonyong-choi/diagramplay/issues/364), [player figure downloads #150](https://github.com/woonyong-choi/diagramplay/issues/150), and [full inspection and source cleanup #251](https://github.com/woonyong-choi/diagramplay/issues/251). The demos explain features with synthetic data and do not report performance measurements from a real service. Check the [verification scope](docs/design/expression-coverage.md#예제와-검증-범위) and [unsupported expressions](docs/design/expression-coverage.md#전용-표현이-없는-범위).

Before 1.0, the source format and commands may change without notice.

## Documentation

The design documents are written in Korean.

- [DiagramPlay usage](docs/usage.md)
  - [Architecture](docs/architecture.md)
  - [Glossary](docs/glossary.md)

[All documentation](docs/README.md)

## Development

Run these commands after the Quick start installation.

```sh
npm test
npm run check
npm run check:docs
npm run check:sources
npm run check:figures
```

Automated checks do not replace visual inspection in a browser. Read [CONTRIBUTING](.github/CONTRIBUTING.md) for contribution steps and [Shared design dependencies](docs/architecture.md#공통-디자인-가져오기) for dependency updates.

## License

[MIT](LICENSE)

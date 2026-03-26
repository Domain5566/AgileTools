# AgileTools — 常用指令（需已安裝 make：Git Bash / WSL / MSYS2 等）
# Windows 原生可改用：npx make 或安裝 GnuWin32 make

NPM ?= npm

.PHONY: help install test test-watch test-cov test-e2e lint lint-server lint-web build build-server build-web dev dev-server dev-web ci clean

help:
	@echo "AgileTools — 可用目標："
	@echo "  make install       安裝依賴 (npm install)"
	@echo "  make test          跑後端單元測試 (Jest)"
	@echo "  make test-watch    後端測試監看模式"
	@echo "  make test-cov      後端測試 + 覆蓋率"
	@echo "  make test-e2e      後端 e2e 測試"
	@echo "  make lint          前後端 lint（各自 workspace）"
	@echo "  make build         建置 server + web"
	@echo "  make ci            lint + test + build（類 CI）"
	@echo "  make dev           前後端同時開發（並行：server + web）"
	@echo "  make dev-server    僅後端開發模式（watch）"
	@echo "  make dev-web       僅前端開發模式"
	@echo "  make clean         刪除各 app 的 dist / .next（不含 node_modules）"

install:
	$(NPM) install

test:
	$(NPM) run test:server

test-watch:
	$(NPM) run test:watch -w server

test-cov:
	$(NPM) run test:cov -w server

test-e2e:
	$(NPM) run test:e2e -w server

lint: lint-server lint-web

lint-server:
	$(NPM) run lint -w server

lint-web:
	$(NPM) run lint -w web

build: build-server build-web

build-server:
	$(NPM) run build:server

build-web:
	$(NPM) run build:web

dev:
	$(NPM) run dev

dev-server:
	$(NPM) run dev:server

dev-web:
	$(NPM) run dev:web

ci: lint test build
	@echo "ci: OK"

clean:
	rm -rf apps/server/dist apps/web/.next

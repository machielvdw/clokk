#!/usr/bin/env bun
import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "clokk",
    version: "0.1.0",
    description: "A local-first CLI time tracker built for humans and AI agents",
  },
  subCommands: {
    start: () => import("./commands/start.ts").then((m) => m.default),
    stop: () => import("./commands/stop.ts").then((m) => m.default),
    status: () => import("./commands/status.ts").then((m) => m.default),
    resume: () => import("./commands/resume.ts").then((m) => m.default),
    switch: () => import("./commands/switch.ts").then((m) => m.default),
    cancel: () => import("./commands/cancel.ts").then((m) => m.default),
    log: () => import("./commands/log.ts").then((m) => m.default),
    edit: () => import("./commands/edit.ts").then((m) => m.default),
    delete: () => import("./commands/delete.ts").then((m) => m.default),
    list: () => import("./commands/list.ts").then((m) => m.default),
    project: () => import("./commands/project.ts").then((m) => m.default),
    report: () => import("./commands/report.ts").then((m) => m.default),
    export: () => import("./commands/export.ts").then((m) => m.default),
    config: () => import("./commands/config.ts").then((m) => m.default),
    schema: () => import("./commands/schema.ts").then((m) => m.default),
    commands: () => import("./commands/commands.ts").then((m) => m.default),
  },
});

runMain(main);

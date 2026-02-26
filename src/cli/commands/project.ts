import { defineCommand } from "citty";

export default defineCommand({
  meta: {
    name: "project",
    description: "Manage projects",
  },
  subCommands: {
    create: () => import("./project/create.ts").then((m) => m.default),
    list: () => import("./project/list.ts").then((m) => m.default),
    edit: () => import("./project/edit.ts").then((m) => m.default),
    archive: () => import("./project/archive.ts").then((m) => m.default),
    delete: () => import("./project/delete.ts").then((m) => m.default),
  },
});

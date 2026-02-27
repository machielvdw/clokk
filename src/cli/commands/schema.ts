import type { CommandDef, ArgsDef, SubCommandsDef } from "citty";
import { defineCommand } from "citty";
import { main } from "@/cli/index.ts";

interface SchemaCommand {
  name: string;
  description: string;
  args: Record<string, unknown>;
  subCommands?: SchemaCommand[];
}

async function buildSchema(
  cmd: CommandDef<ArgsDef>,
): Promise<SchemaCommand> {
  const meta = typeof cmd.meta === "function" ? await cmd.meta() : (cmd.meta ?? {});
  const args = typeof cmd.args === "function" ? await cmd.args() : (cmd.args ?? {});
  const schema: SchemaCommand = {
    name: ("name" in meta ? meta.name : "") ?? "",
    description: ("description" in meta ? meta.description : "") ?? "",
    args: args as Record<string, unknown>,
  };

  const rawSubs = typeof cmd.subCommands === "function"
    ? await cmd.subCommands()
    : cmd.subCommands;
  const subCommands = rawSubs as SubCommandsDef | undefined;

  if (subCommands && Object.keys(subCommands).length > 0) {
    schema.subCommands = [];
    for (const [, sub] of Object.entries(subCommands)) {
      const resolved = typeof sub === "function"
        ? await (sub as () => Promise<CommandDef<ArgsDef>>)()
        : sub;
      if (resolved) {
        schema.subCommands.push(await buildSchema(resolved as CommandDef<ArgsDef>));
      }
    }
  }

  return schema;
}

export default defineCommand({
  meta: {
    name: "schema",
    description: "Output complete CLI schema as JSON",
  },
  args: {},
  async run() {
    const schema = await buildSchema(main as CommandDef<ArgsDef>);
    process.stdout.write(JSON.stringify(schema, null, 2) + "\n");
  },
});

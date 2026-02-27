import { render } from "@opentui/solid";
import { getContext } from "@/cli/context.ts";
import { App } from "@/tui/app.tsx";
import { RepoProvider } from "@/tui/hooks/use-repo.ts";

export async function startApp(): Promise<void> {
  const { repo } = await getContext();

  await render(
    () => (
      <RepoProvider value={repo}>
        <App />
      </RepoProvider>
    ),
    { exitOnCtrlC: false },
  );
}

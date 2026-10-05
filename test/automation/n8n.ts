/* eslint-disable @n8n/community-nodes/no-restricted-imports, @n8n/community-nodes/no-restricted-globals -- test code runs in Node/vitest, not in n8n */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IDataObject, INodeExecutionData } from 'n8n-workflow';
import { inject } from 'vitest';

export interface N8nEnvironment {
	home: string;
	env: Record<string, string>;
}

declare module 'vitest' {
	export interface ProvidedContext {
		n8n: N8nEnvironment;
	}
}

/** Start a process with its output in a file under the n8n folder. */
export function start(command: string, args: string[], { home, env }: N8nEnvironment) {
	const log = join(home, `${randomUUID()}.log`);
	const fd = openSync(log, 'w');
	const child = spawn(command, args, {
		cwd: home,
		env: { ...process.env, ...env },
		stdio: ['ignore', fd, fd],
	});
	// The child has its own copy of the file descriptor.
	closeSync(fd);
	const exit = new Promise<number | null>((done, fail) =>
		child.on('error', fail).on('close', done),
	);
	return { child, exit, output: () => readFileSync(log, 'utf8') };
}

/** Run the n8n CLI. Output goes to a file: n8n exits right after printing and cuts off a pipe. */
export async function n8n(args: string[], environment: N8nEnvironment): Promise<string> {
	const run = start('n8n', args, environment);
	const code = await run.exit;
	if (code !== 0) throw new Error(`n8n ${args.join(' ')} exited with ${code}:\n${run.output()}`);
	return run.output();
}

interface RunData {
	data: {
		resultData: { runData: Record<string, Array<{ data?: { main: INodeExecutionData[][] } }>> };
	};
}

/** Outputs of one workflow run, by node name. */
class WorkflowRun {
	constructor(private readonly result: RunData) {}

	items(node: string): INodeExecutionData[] {
		const runs = this.result.data.resultData.runData[node];
		if (!runs) throw new Error(`Node "${node}" did not run`);
		return runs.flatMap((run) => run.data?.main[0] ?? []);
	}

	/** The JSON of the first output item; fails with the error of the node if it has one. */
	json(node: string): IDataObject {
		const json = this.items(node)[0]?.json;
		if (json?.error) throw new Error(`Node "${node}" failed: ${String(json.error)}`);
		return json;
	}

	/** The error the node continued with. */
	error(node: string): unknown {
		return this.items(node)[0]?.json.error;
	}

	/** Content of the binary output; n8n keeps it in its storage folder. */
	file(node: string): Buffer {
		const binary = this.items(node)[0]?.binary?.data;
		if (!binary)
			throw new Error(`Node "${node}" returned no file: ${JSON.stringify(this.json(node))}`);
		return readFileSync(join(inject('n8n').home, '.n8n/storage', binary.id!.split(':')[1]));
	}

	fileName(node: string) {
		return this.items(node)[0]?.binary?.data.fileName;
	}
}

const runs = new Map<string, Promise<WorkflowRun>>();

/** Execute an imported workflow once per test file and return its outputs. */
export function runWorkflow(id: string): Promise<WorkflowRun> {
	if (!runs.has(id)) {
		runs.set(
			id,
			n8n(['execute', `--id=${id}`, '--rawOutput'], inject('n8n')).then((output) => {
				// The run data is printed as indented JSON between log lines.
				const start = output.indexOf('\n{\n') + 1;
				return new WorkflowRun(JSON.parse(output.slice(start, output.indexOf('\n}', start) + 2)));
			}),
		);
	}
	return runs.get(id)!;
}

export const startsWith = (file: Buffer, magic: string) =>
	file.subarray(0, magic.length).toString('latin1') === magic;

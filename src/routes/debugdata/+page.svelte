<script lang="ts">
	import { GameState, parseMessage, fileCalcDistribution } from '$lib/StateManager.svelte';
	import { Buffer } from 'buffer';
	import { JSONEditor, SelectionType, Mode } from 'svelte-jsoneditor';
	import type { Content, JSONContent, JSONEditorSelection } from 'svelte-jsoneditor';

	const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

	let files: FileList | undefined = $state();

	let file: Buffer | undefined = $state();

	//TODO: example data -> remove it
	let gs: GameState | undefined = $state();

	let content_list: JSONContent = $state({ json: [] });
	let content_msg: JSONContent = $state({ json: {} });

	let editor_list: JSONEditor;
	let editor_msg: JSONEditor;

	$effect(() => {
		content_list = { json: gs?.line_pointers || [] };
	});

	$effect(() => {
		if (files && files.length > 0) {
			console.log('READING');
			const reader = new FileReader();
			reader.onload = (ev) => {
				const result = ev.target?.result;
				console.log(result);
				if (result instanceof ArrayBuffer) {
					file = Buffer.from(result);
					gs = new GameState(file);
					content_msg = { json: {} };
				}
			};
			reader.readAsArrayBuffer(files[0]);
		}
	});

	function closeFile() {
		files = undefined;
		file = undefined;
		console.log('File closed');
		gs = undefined;
		content_msg = { json: {} };
		// content_list = { json: [] };
	}

	// async function process() {
	// 	gs = new GameState(file!);
	// 	await gs.verify_integrity();
	// }

	// // eslint-disable-next-line @typescript-eslint/no-explicit-any
	// async function test_call(...args: any[]) {
	// 	console.log("Called:", args);
	// }

	async function view_msg(selection?: JSONEditorSelection) {
		if (selection && selection.type == SelectionType.value) {
			const index = parseInt(selection.path[0]);
			content_msg = { json: parseMessage(file!, content_list.json[index].pt) };
			// await editor.refresh();
			// await editor.update(content_msg);
			await delay(0);
			await editor_msg.expand([], () => true)
			// await editor.expand([], (relativePath) => relativePath.length < 2);
		}
	}

	//TODO: Might get fixed upstream over-time
	function list_change(content: Content) {
		content_list = $state.snapshot(content as JSONContent);
	}

	async function count_messages() {
		const a = fileCalcDistribution(file!);
		const result: Record<string, string | number>[] = [];
		Object.keys(a).forEach((m: number) => {
			Object.keys(a[m]).forEach((i: number) => {
				result.push({
					id: `${m}-${i}`,
					count: a[m][i].count,
					info: a[m][i].info
				});
			});
		});
		content_list = { json: result };
	}
</script>

<div class="wrapper">
	<nav>
		<button class="file-input-wrapper" onclick={closeFile}>
			{#if file}
				Close
			{:else}
				<input bind:files type="file" accept=".wdcap" /> Select File
			{/if}
		</button>
		<!-- <button class="hmm" onclick={process}> Process GS </button> -->
		<button class="hmm" onclick={count_messages}> Calc Distribution </button>
	</nav>
	<div id="messages">
		<div class="my-json-editor jse-theme-dark">
			<JSONEditor
				bind:this={editor_list}
				bind:content={content_list}
				mode={Mode.table}
				onSelect={view_msg}
				onChange={list_change}
			/>
		</div>
		<div
			class="my-json-editor jse-theme-dark"
			style={`--display: ${content_msg.json ? 'block' : 'none'}`}
		>
			<JSONEditor bind:this={editor_msg} bind:content={content_msg} />
		</div>
	</div>
</div>

<style type="scss">
	@import 'svelte-jsoneditor/themes/jse-theme-dark.css';
	.wrapper {
		width: 100%;
		height: 100%;
	}

	#messages {
		display: flex;
		flex-direction: row;
		height: calc(100% - 42px);
		& > div {
			flex: 1;
		}
	}

	@media (max-width: 768px) {
		#messages {
			flex-direction: column;
			& > div {
				height: 50%;
			}
		}
	}

	.file-input-wrapper {
		display: inline-block;
		overflow: hidden;
		border-radius: 4px;
		background-color: #444444;
		color: white;
		padding: 0.5rem 1rem;
		cursor: pointer;
		transition: background-color 0.2s;
		&:hover {
			background-color: #555555;
		}
		input {
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			opacity: 0;
			cursor: pointer;
		}
	}
	nav {
		height: 42px;
		z-index: 1000000;
		background-color: #44444488;
		color: white;
	}
</style>

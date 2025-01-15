<script lang="ts">
	import { GameState, parseMessage, fileCalcDistribution } from '$lib/StateManager.svelte';
	import { Buffer } from 'buffer';
	import { JSONEditor, type Content } from 'svelte-jsoneditor';

	let files: FileList | undefined = $state();

	let file: Buffer | undefined = $state();

	//TODO: example data -> remove it
	let gs: GameState | undefined = $state();

	let content_list: Content = $state({json:undefined});
	let content_msg: Content = $state({json:undefined});

	let editor: JSONEditor;

	$effect(() => {
		content_list = { json: gs?.line_pointers };
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
				}
			};
			reader.readAsArrayBuffer(files[0]);
		}
	});

	function closeFile() {
		files = undefined;
		file = undefined;
		console.log('File closed');
		content_msg = { json: undefined };
		content_list = { json: undefined };
	}

	async function process() {
		gs = new GameState(file!);
		await gs.verify_integrity();
		// console.log(gs.line_pointers.splice(0,20))
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async function test_call(...args: any[]) {
		console.log(args);

		// console.log(])
	}

	async function count_messages() {
		const a = fileCalcDistribution(file!);
		const result: Record<string, string|number>[] = [];
		Object.keys(a).forEach((m: number) => {
			Object.keys(a[m]).forEach((i: number) => {
				result.push({
					id: `${m}-${i}`,
					count: a[m][i].count,
					info: a[m][i].info
				});
			});
		});
		content_list = {json: result};
	}

	async function view_msg(view_index: number) {
		content_msg.json = parseMessage(file!, content_list.json[view_index].pt);
		await editor.update(content_msg);
		// delay(editor.expand, 0, [], () => true)
		await editor.expand([], (relativePath) => relativePath.length < 2);
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
		<button class="hmm" onclick={process}> Process GS </button>
		<button class="hmm" onclick={count_messages}> Calc Distribution </button>
	</nav>
	<div id="messages">
		<div class="my-json-editor jse-theme-dark">
			<JSONEditor
				bind:content={content_list}
				mode="table"
				onSelect={(sel: any) => view_msg(sel.path[0])}
			/>
		</div>
		<div
			class="my-json-editor jse-theme-dark"
			style={`--display: ${content_msg.json ? 'block' : 'none'}`}
		>
			<JSONEditor bind:this={editor} bind:content={content_msg} />
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

	.msg_row {
		display: flex;
		flex-direction: row;
		background-color: var(--color);
		border-radius: 5px;
		& > div {
			padding: 10px; /* Adds some padding for readability */
			text-align: right; /* Centers the text in each column */

			&:nth-child(2) {
				flex: 1;
				text-align: left; /* Left aligns the first column */
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

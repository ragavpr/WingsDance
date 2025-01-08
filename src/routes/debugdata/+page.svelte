<script lang="ts">
	import { GameState } from '$lib/StateManager.svelte';
	import { Buffer } from 'buffer';

	let isOpen = false;

	let files: FileList | undefined = $state();

	let file: Buffer | undefined = $state();

	let gs: GameState | undefined = $state();

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
	}

	async function process() {
		gs = new GameState(file!);
		await gs.verify_integrity();
		console.log(gs.integritous);
	}
</script>

<div>
	<p>
		File Integrity: {gs?.integritous}
	</p>
</div>

<nav>
	<button class="file-input-wrapper" onclick={closeFile}>
		{#if file}
			Close
		{:else}
			<input bind:files type="file" accept=".wdcap" /> Select File
		{/if}
	</button>
	<button class="hmm" onclick={process}> Act0 </button>
</nav>

<style type="scss">
	#game-wrapper {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}
	.file-input-wrapper {
		display: inline-block;
		position: relative;
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
		position: absolute;
		z-index: 1000000;
		background-color: #44444488;
		color: white;
		bottom: 0;
		padding: 0.5rem;
	}
</style>

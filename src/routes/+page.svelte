<script lang="ts">
	import type { Scene } from 'phaser';
	import type { Game } from '../game/scenes/Game';
	import PhaserGame, { type TPhaserRef } from '../game/PhaserGame.svelte';
	
	import { onMount } from 'svelte';
	import { GameState } from '$lib/StateManager.svelte';
	import { Buffer } from 'buffer';
	import { TimeLine } from '$lib/timeline.svelte';
	import { time } from 'drizzle-orm/mysql-core';

	//  References to the PhaserGame component (game and scene are exposed)
	let phaserRef: TPhaserRef = { game: null, scene: null };

	const color: Record<number, number> = {
		0: 0xff3737ff,
		1: 0xffff7f37,
		2: 0xffc3ffc3
	};

	let canvas: HTMLCanvasElement;
	let timeline: TimeLine = $state();

	let files: FileList | undefined = $state();

	let file: Buffer | undefined = $state();

	//TODO: example data -> remove it
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

	onresize = () => {
		canvas.width = Math.min(window.innerWidth, 980);
		timeline?.draw();
	};

	onMount(() => {
		timeline = new TimeLine(canvas);
	});

	$effect(() => {
		const scene = phaserRef.scene as Game;
		if(timeline?.position && scene) {
			const state = gs?.get_planes_at_time(timeline.position)
			if(state)	scene.planes_state = state
		}
	})

	function closeFile() {
		files = undefined;
		file = undefined;
		console.log('File closed');
	}

	function process() {
		if (file) {
			gs = new GameState(file!);

			const max_length = Math.ceil(gs.line_pointers[gs.line_pointers.length - 1].time / 10);
			console.log(max_length);
			if (timeline) {
				// this.image = new ImageData(1, 1);
				const image = new ImageData(max_length, 1);
				const data = new Uint32Array(image.data.buffer);
				data.fill(0x88ffffff);

				gs.line_pointers.forEach((msg) => {
					if(msg.dir == 0 && [0xa2, 0xa3, 0xa9].includes(msg.type)) 
						data[Math.floor(msg.time / 10)] = color[msg.dir];
				});
				timeline.image = image;
				timeline.image_scale = 10;
				timeline.target_scale = 0.5;
				timeline.target_position = gs.line_pointers[0].time;
			}
		}
	}

	// Event emitted from the PhaserGame component
	const currentScene = (scene: Scene) => {
		// canMoveSprite = scene.scene.key !== 'Game';
	};
</script>

<div id="app">
	<PhaserGame bind:phaserRef currentActiveScene={currentScene} />
	<div>
		<button class="file-input-wrapper" onclick={closeFile}>
			{#if file}
				Close
			{:else}
				<input bind:files type="file" accept=".wdcap" /> Select File
			{/if}
		</button>
		<button class="hmm" onclick={process}> Process GS </button>
		<!-- <div> -->
			<!-- <button class="button" onclick={updateScene}>Update Scene</button> -->
		<!-- </div> -->
		<!-- <div>
			<button class="button" disabled={canMoveSprite} on:click={moveSprite}>Toggle Movement</button>
		</div> -->
	</div>
</div>
<div id="timeline">
	<canvas
		bind:this={canvas}
		onmousedown={timeline.handleMouseDown.bind(timeline)}
		onmouseup={timeline.handleMouseUp.bind(timeline)}
		onmouseleave={timeline.handleMouseUp.bind(timeline)}
		onmousemove={timeline.handleMouseMove.bind(timeline)}
		onwheel={timeline.handleScroll.bind(timeline)}
		ontouchstart={timeline.handleTouchStart.bind(timeline)}
		ontouchmove={timeline.handleTouchMove.bind(timeline)}
		ontouchend={timeline.handleTouchEnd.bind(timeline)}
		width={Math.min(window.innerWidth, 980)}
		height="80"
	></canvas>
</div>

<style>

	#timeline {
		position: absolute;
		width: 100%;
		display: flex;
		justify-content: center;
		bottom: 0;
	}

	#app {
		width: 100%;
		height: 100vh;
		overflow: hidden;
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.spritePosition {
		margin: 10px 0 0 10px;
		font-size: 0.8em;
	}

	.button {
		width: 140px;
		margin: 10px;
		padding: 10px;
		background-color: #000000;
		color: rgba(255, 255, 255, 0.87);
		border: 1px solid rgba(255, 255, 255, 0.87);
		cursor: pointer;
		transition: all 0.3s;

		&:hover {
			border: 1px solid #0ec3c9;
			color: #0ec3c9;
		}

		&:active {
			background-color: #0ec3c9;
		}

		/* Disabled styles */
		&:disabled {
			cursor: not-allowed;
			border: 1px solid rgba(255, 255, 255, 0.3);
			color: rgba(255, 255, 255, 0.3);
		}
	}
</style>

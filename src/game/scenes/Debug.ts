import { type GameObjects, Scene } from 'phaser';

import { EventBus } from '../EventBus';

export class Debug extends Scene {
	background: GameObjects.Image;
	plane: GameObjects.Sprite;
	tween: Phaser.Tweens.Tween | null;

	constructor() {
		super('Debug');
	}

	create() {
		this.background = this.add.image(0, 0, 'debuggrid').setOrigin(0, 0);
		this.plane = this.add.sprite(10, 10, 'plane').setOrigin(0, 0).setTint(0xffff00);

		this.tween = this.tweens.addCounter({
			from: 0,
			to: 360,
			duration: 1000,
			loop: -1,
			onUpdate: () => {
				this.plane.setAngle(this.tween!.getValue());
			}
		});
	}

	// changeScene ()
	// {
	//     if (this.tween)
	//     {
	//         this.tween.stop();
	//         this.tween = null;
	//     }

	//     this.scene.start('Game');
	// }

	// moveLogo (vueCallback: ({ x, y }: { x: number, y: number }) => void)
	// {
	//     if (this.tween)
	//     {
	//         if (this.tween.isPlaying())
	//         {
	//             this.tween.pause();
	//         }
	//         else
	//         {
	//             this.tween.play();
	//         }
	//     }
	//     else
	//     {
	//         this.tween = this.tweens.add({
	//             targets: this.logo,
	//             x: { value: 750, duration: 3000, ease: 'Back.easeInOut' },
	//             y: { value: 80, duration: 1500, ease: 'Sine.easeOut' },
	//             yoyo: true,
	//             repeat: -1,
	//             onUpdate: () => {
	//                 if (vueCallback)
	//                 {
	//                     vueCallback({
	//                         x: Math.floor(this.logo.x),
	//                         y: Math.floor(this.logo.y)
	//                     });
	//                 }
	//             }
	//         });
	//     }
	// }
}

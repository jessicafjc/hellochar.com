import * as React from "react";
import * as THREE from "three";

import { AudioClip } from "../../audio";
import { Noise } from "../../common/perlin";
import { lerp } from "../../math";
import { ISketch } from "../../sketch";

const noise = new Noise();
noise.octaveNum = 3;

class Ground {
    private geom = (() => {
        const geom = new THREE.PlaneBufferGeometry(1000, 1000, 100, 100);
        geom.rotateX(-Math.PI / 2);

        return geom;
    })();

    private positions = this.geom.getAttribute("position") as THREE.Float32BufferAttribute;

    constructor(private landscape: Landscape, scene: THREE.Scene) {
        const mat = new THREE.MeshPhongMaterial({
            flatShading: true,
            shininess: 2,
            side: THREE.DoubleSide,
            // color: new Color("#F9FFFF"),
            color: new THREE.Color("#31DCEC"),
        });
        const mesh = new THREE.Mesh(this.geom, mat);
        mesh.position.y -= 50;
        scene.add(mesh);
    }

    animate(timeElapsed: number) {
        const { positions } = this;
        const heightScale = THREE.Math.mapLinear(THREE.Math.smootherstep(timeElapsed, 4000, 6000), 0, 1, 0, 35);
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);
            // const wantedY = noise.octaveSimplex2(x, z) * 2;
            const wantedY = (noise.simplex2(x / 80, z / 80) + 0.5) * heightScale * this.landscape.getRockiness(x, z) - heightScale / 2;
            positions.setY(i, wantedY);
        }
        positions.needsUpdate = true;
        this.geom.computeVertexNormals();
    }
}

class WaterDrops {
    private geometry = (() => {
        const geometry = new THREE.Geometry();
        for (let i = 0; i < 10000; i++) {
            const v = new THREE.Vector3(
                THREE.Math.randFloat(-400, 400),
                THREE.Math.randFloat(400, 800),
                THREE.Math.randFloat(-400, 400),
            );
            geometry.vertices.push(v);
        }
        return geometry;
    })();

    constructor(scene: THREE.Scene) {
        const material = new THREE.PointsMaterial({
            color: new THREE.Color("#31DCEC"),
            transparent: true,
            opacity: 0.5,
            size: 1.2,
            sizeAttenuation: true,
            map: new THREE.TextureLoader().load("/assets/sketches/drop.png"),
        });
        const points = new THREE.Points(this.geometry, material);
        scene.add(points);
    }

    animate(timeElapsed: number) {
        for (const vertex of this.geometry.vertices) {
            vertex.y -= 1.5;
            if (vertex.y < -60) {
                vertex.y += 200;
            }
            vertex.x -= 0.3;
            if (vertex.x < -400) {
                vertex.x += 800;
            }
        }
        this.geometry.verticesNeedUpdate = true;
    }
}

class Attribution extends React.Component<{}, {}> {
    render() {
        const text = this.renderAttribution();
        return <div style={{margin: "auto auto 10px auto", color: "#8a9ba8"}}>{text}</div>
    }

    private renderAttribution() {
        return (
            <div style={{fontSize: "0.5em"}}>
                <a style={{color: "#8a9ba8"}} href="http://www.orangefreesounds.com/light-rain-and-thunder-sounds/">Rain sound</a>
                &nbsp;
                &bull;
                &nbsp;
                <a style={{color: "#8a9ba8"}} href="https://www.flaticon.com/free-icon/drop_25039">Raindrop texture</a>
            </div>
            );
    }
}

const bgColor = "#10161a";

class Landscape extends ISketch {
    private get scrollTop() {
        return document.documentElement.scrollTop || document.body.scrollTop;
    }

    elements = [<Attribution />];
    public events = {
        mousemove: (event: JQuery.Event) => {
            this.mouseX = event.offsetX == null ? (event.originalEvent as MouseEvent).layerX : event.offsetX;
            this.mouseY = event.offsetY == null ? (event.originalEvent as MouseEvent).layerY : event.offsetY;
        },
    };
    private mouseX = 0;
    private mouseY = 0;
    private ground!: Ground;
    private scene = new THREE.Scene();
    private camera!: THREE.PerspectiveCamera;
    private tree01?: THREE.Object3D;
    private fog = new THREE.FogExp2(bgColor, 0.004);
    private water!: WaterDrops;
    private composer!: THREE.EffectComposer;
    init() {
        this.renderer.domElement.style.background = bgColor;
        this.renderer.setClearColor(bgColor);
        this.ground = new Ground(this, this.scene);
        this.scene.fog = this.fog;
        this.camera = this.initCamera(this.aspectRatio);
        this.initLights(this.scene);
        // this.loadAndInitTrees();
        this.water = new WaterDrops(this.scene);
        this.initComposer();
        this.initAudio();
    }

    private initAudio() {
        const rain = new AudioClip({
            autoplay: true,
            loop: true,
            context: this.audioContext,
            srcs: ["/assets/audio/light-rain-and-thunder-sounds.mp3"],
            volume: 0.5,
        });
        rain.getNode().connect(this.audioContext.gain);
    }

    private initComposer() {
        this.composer = new THREE.EffectComposer(this.renderer);

        const renderPass = new THREE.RenderPass(this.scene, this.camera);
        (renderPass as any).renderToScreen = true;
        this.composer.addPass(renderPass);

        // const sao = new THREE.SAOPass(this.scene, this.camera, false, true);
        // // sao.params.output = THREE.SAOPass.OUTPUT.SAO;
        // sao.params.saoBias = 5.5;
        // sao.params.saoIntensity = 0.004;
        // sao.params.saoScale = 10;
        // sao.params.saoKernelRadius = 100;
        // sao.params.saoBlur = true;
        // // sao.renderToScreen = true;
        // this.composer.addPass(sao);

        // const ssaa = new (THREE as any).SSAARenderPass(this.scene, this.camera);
        // ssaa.unbiased = true;
        // ssaa.sampleLevel = 2;
        // ssaa.renderToScreen = true;
        // this.composer.addPass(ssaa);

        // const copyPass = new THREE.ShaderPass(THREE.CopyShader);
        // copyPass.renderToScreen = true;
        // this.composer.addPass(copyPass);
    }

    getRockiness(x: number, z: number) {
        const len = x * x + z * z;
        return 1 / (1 + len / 15000);
    }

    private initCamera(aspectRatio: number) {
        const camera = new THREE.PerspectiveCamera(60, 1 / aspectRatio, 0.1, 1000);
        camera.position.x = -23;
        camera.position.y = -1.8;
        // camera.position.y = 10;
        camera.position.z = 148;
        return camera;
    }

    private initLights(scene: THREE.Scene) {
        // const directional = new DirectionalLight("rgb(208, 220, 239)", 1);
        const directional = new THREE.DirectionalLight("rgb(255, 255, 255)", 0.25);
        directional.position.set(1, 1, 1);
        scene.add(directional);

        const ambient = new THREE.AmbientLight(new THREE.Color("rgb(131, 240, 252)"), 0.15);
        scene.add(ambient);
    }

    animate(millisElapsed: number) {
        const { camera } = this;
        camera.position.x = -23 + THREE.Math.mapLinear(this.mouseX, 0, this.canvas.width, 5, -5);
        camera.position.y = -1.8 + THREE.Math.mapLinear(this.mouseY, 0, this.canvas.height, -2, 2);
        // // camera.position.y = 10;
        // camera.position.z = lerp(camera.position.z, 148 + this.scrollTop / 100, 0.1);
        camera.lookAt(new THREE.Vector3());
        this.ground.animate(this.timeElapsed);
        this.water.animate(this.timeElapsed);
        // this.renderer.render(this.scene, this.camera);
        this.composer.render();
    }

    resize() {
        this.camera.aspect = 1 / this.aspectRatio;
        this.camera.updateProjectionMatrix();
    }
}

function scheduleTween(fn: (lerp: number) => void, delay: number, duration: number) {
    setTimeout(() => {
        const startTime = performance.now();
        fn(0);
        function tween() {
            const now = performance.now();
            const lerp = (now - startTime) / duration;
            if (lerp < 1) {
                fn(lerp);
                requestAnimationFrame(tween);
            } else {
                fn(1);
                // don't recurse
            }
        }
        requestAnimationFrame(tween);
    }, delay);
}

export default Landscape;

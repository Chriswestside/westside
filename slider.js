
import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js';
import { VideoTexture } from 'https://unpkg.com/three@0.127.0/build/three.module.js';



const fragmentShader = `
uniform sampler2D uTexture;
uniform float uAlpha;
uniform vec2 uOffset;
varying vec2 vUv;

vec3 rgbShift(sampler2D textureImage, vec2 uv, vec2 offset) {
   float r = texture2D(textureImage, uv + offset / 500.0).r;
   vec2 gb = texture2D(textureImage, uv).gb;
   return vec3(r, gb);
}

void main() {
   vec3 color = rgbShift(uTexture, vUv, uOffset);
   gl_FragColor = vec4(color, uAlpha);
}
`;

const vertexShader = `
uniform sampler2D uTexture;
uniform vec2 uOffset;
varying vec2 vUv;

#define M_PI 3.1415926535897932384626433832795

vec3 deformationCurve(vec3 position, vec2 uv, vec2 offset) {
    position.x += sin(uv.y * M_PI) * offset.x;
    return position;
}

void main() {
   vUv = uv;
   vec3 newPosition = deformationCurve(position, uv, uOffset);
   gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

let scrollable = document.querySelector('.scrollable');
let ease = 0.075;

function lerp(start, end, t) {
    return start * (1 - t) + end * t;
}

function init() {
    document.body.style.height = `${scrollable.getBoundingClientRect().height}px`;
}

window.addEventListener('scroll', () => {
    if (window.effectCanvasInstance) {
        window.effectCanvasInstance.target = window.scrollY;
    }
});

document.body.style.height = `${scrollable.getBoundingClientRect().height}px`;


function setLargeScrollableHeight() {
    const largeHeight = 100000000;
    scrollable.style.height = `${largeHeight}px`;
}




function planeCurve(g, z) {
    if (!g || isNaN(z)) return; // Check if geometry and z are valid

    let p = g.parameters;
    let hw = p.width * 0.5;

    let a = new THREE.Vector2(-hw, 0);
    let b = new THREE.Vector2(0, z);
    let c = new THREE.Vector2(hw, 0);

    let ab = new THREE.Vector2().subVectors(a, b);
    let bc = new THREE.Vector2().subVectors(b, c);
    let ac = new THREE.Vector2().subVectors(a, c);

    let crossProduct = ab.cross(ac);
    if (crossProduct === 0) return; // Avoid division by zero

    let r = (ab.length() * bc.length() * ac.length()) / (2 * Math.abs(crossProduct));

    let center = new THREE.Vector2(0, z - r);
    let baseV = new THREE.Vector2().subVectors(a, center);
    let baseAngle = baseV.angle() - (Math.PI * .5);
    let arc = baseAngle * 2;

    let uv = g.attributes.uv;
    let pos = g.attributes.position;
    let mainV = new THREE.Vector2();
    for (let i = 0; i < uv.count; i++) {
        let uvRatio = 1 - uv.getX(i);
        let y = pos.getY(i);
        mainV.copy(c).rotateAround(center, (arc * uvRatio));
        pos.setXYZ(i, mainV.x, y, -mainV.y);
    }

    pos.needsUpdate = true;
}

  


class EffectCanvas {
    constructor() {
        this.container = document.querySelector('main');
        this.videos = [
            { url: "./video/1.mp4", heading: 'Heading 1' },
            { url: "./video/2.mp4", heading: 'Heading 2' },
            { url: "./video/3.mp4", heading: 'Heading 3' },
            { url: "./video/4.mp4", heading: 'Heading 4' },
            { url: "./video/5.mp4", heading: 'Heading 5' }
        ];
        this.meshItems = [];
        this.current = 0;
        this.target = 0;
        this.setupCamera();
        this.createMeshItems();
        this.render = this.render.bind(this);
        this.render();
    }

    get viewport() {
        let width = window.innerWidth;
        let height = window.innerHeight;
        let aspectRatio = width / height;
        return {
            width,
            height,
            aspectRatio
        };
    }

    setupCamera() {
        window.addEventListener('resize', this.onWindowResize.bind(this), false);
        this.scene = new THREE.Scene();
        let perspective = 1200;
        const fov = (125 * (2 * Math.atan(window.innerHeight / 2 / perspective))) / Math.PI;
        this.camera = new THREE.PerspectiveCamera(fov, this.viewport.aspectRatio, 1, 8000);
        const circleRadius = 1200;
        this.camera.position.set(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(this.viewport.width, this.viewport.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
    }

    onWindowResize() {
        init();
        this.camera.aspect = this.viewport.aspectRatio;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.viewport.width, this.viewport.height);
        setLargeScrollableHeight();

    }

    createMeshItems() {
        const totalVideos = this.videos.length;
        const circleRadius = 1200;
        this.carouselGroup = new THREE.Group();
        this.scene.add(this.carouselGroup);
            this.videos.forEach((videoData, index) => {
            let meshItem = new MeshItem(videoData.url, this.carouselGroup, this); // Pass the EffectCanvas instance
            this.meshItems.push(meshItem);
            const angle = (index / totalVideos) * Math.PI * 2;
            meshItem.setPosition(angle, circleRadius);
        });
    }


    
    smoothScroll() {
        const totalHeight = document.body.offsetHeight - window.innerHeight;
        if (window.scrollY >= totalHeight) {
            window.scrollTo(0, 1);
        }
        this.target = window.scrollY;
        this.current = lerp(this.current, this.target, ease);
        scrollable.style.transform = `translate3d(0, ${-this.current}px, 0)`;

        // Update the target and current values for each MeshItem
        this.meshItems.forEach(item => {
            item.target = this.target;
            item.current = this.current;

        });
    }
    render() {
        this.smoothScroll();
        const rotationSpeedFactor = 0.5;
        const totalVideos = this.videos.length;
        const scrollPercentage = this.current / (document.body.offsetHeight - window.innerHeight);
        const anglePerVideo = (2 * Math.PI) / totalVideos;
        const rotationAngle = (scrollPercentage * totalVideos * 2 * Math.PI * rotationSpeedFactor) % (2 * Math.PI);
    
        this.carouselGroup.rotation.y = rotationAngle -60;
    
        for (let i = 0; i < this.meshItems.length; i++) {
            this.meshItems[i].updateUniforms(this.current, this.target);
        }

             this.meshItems.forEach(item => {
            if (item.isVideoInView(this.camera)) {
                if (item.video.paused) {
                    item.video.play();
                }
            } else {
                if (!item.video.paused) {
                    item.video.pause();
                }
            }
        });
    
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.render.bind(this)); // Ensure 'this' context is preserved
    }
    
    

}


class MeshItem {
    constructor(videoURL, group, effectCanvasInstance) { // Accept the EffectCanvas instance
        this.effectCanvas = effectCanvasInstance; // Store the EffectCanvas instance
        this.video = document.createElement('video');
        this.video.mute = true;
        this.video.src = videoURL;
        this.video.loop = true;
        this.group = group;
        this.video.load();
        this.createMesh();
           // Event listener to play the video when it's ready
           this.video.addEventListener('canplaythrough', () => {
            this.video.play().catch(e => console.error("Error playing video:", e));
        });
    }

    setPosition(x, y) {
        const RADIUS = y;
        const theta = x;
        this.mesh.position.set(RADIUS * Math.cos(theta), 0, RADIUS * Math.sin(theta));
        this.mesh.lookAt(0, 0, 0);
    }

    createMesh() {
        const aspectRatio = 16 / 9;
        const width = 1.35 * window.innerWidth * 0.35;
        const height = width / aspectRatio;

        this.geometry = new THREE.PlaneBufferGeometry(width, height, 100, 100);
        planeCurve(this.geometry, 100); // Apply the curve to the video plane

        this.videoTexture = new THREE.VideoTexture(this.video);
        this.uniforms = {
            uTexture: {
                value: this.videoTexture
            },
            uOffset: {
                value: new THREE.Vector2(0.0, 0.0)
            },
            uAlpha: {
                value: 1.
            }
        };
        this.material = new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            transparent: true,
            side: THREE.FrontSide
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.group.add(this.mesh);
    }

    isVideoInView(camera) {
        const meshPosition = new THREE.Vector3();
        this.mesh.getWorldPosition(meshPosition);
        const cameraPosition = camera.position;

        const viewDirection = new THREE.Vector3();
        camera.getWorldDirection(viewDirection);

        const toMeshDirection = new THREE.Vector3().subVectors(meshPosition, cameraPosition).normalize();

        // Check if the angle between the camera view direction and the mesh is small enough
        const angle = toMeshDirection.angleTo(viewDirection);
        return angle < Math.PI / 8; // Example threshold, adjust as needed
    }


    updateUniforms() {
        const angle = this.mesh.position.angleTo(new THREE.Vector3(0, 0, 1));
        const deformationFactor = Math.sin(angle) * 0.5 + 0.5;
        const scrollDeformation = -(this.target - this.current) * 0.5 * deformationFactor;
        
        // Adjust the deformation based on the scroll position
        planeCurve(this.geometry, 200 + scrollDeformation); // Adjust the 300 value as needed

        this.uniforms.uOffset.value.set(scrollDeformation, 0.0);
    }
}

init();
window.effectCanvasInstance = new EffectCanvas();
setLargeScrollableHeight();

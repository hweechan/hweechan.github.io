import { resizeAspectRatio, setupText, updateText, Axes } from '../util/util.js';
import { Shader, readShaderFile } from '../util/shader.js';


const canvas = document.getElementById('glCanvas');
const gl = canvas.getContext('webgl2');
let isInitialized = false;
let shader;
let vao;
let positionBuffer;
let isDrawing = false;
let startPoint = null;
let tempEndPoint = null;
let lines = [];
let intersectionPoints = [];

let textOverlay1, textOverlay2, textOverlay3;
let axes = new Axes(gl, 0.85);

document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) return;
    main().then(success => {
        if (success) isInitialized = true;
    });
});

function initWebGL() {
    if (!gl) return false;
    canvas.width = 700;
    canvas.height = 700;
    resizeAspectRatio(gl, canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.2, 0.3, 1.0);
    return true;
}

function setupBuffers() {
    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    shader.setAttribPointer('a_position', 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
}

function convertToWebGLCoordinates(x, y) {
    return [(x / canvas.width) * 2 - 1, -((y / canvas.height) * 2 - 1)];
}

const getDist = (p1, p2) => Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);

function calculateIntersections(circle, line) {
    const cx = circle[0], cy = circle[1], r = getDist([circle[0], circle[1]], [circle[2], circle[3]]);
    const x1 = line[0], y1 = line[1], x2 = line[2], y2 = line[3];

    const dx = x2 - x1;
    const dy = y2 - y1;

    const a = dx * dx + dy * dy;
    const b = 2 * (dx * (x1 - cx) + dy * (y1 - cy));
    const c = (x1 - cx) ** 2 + (y1 - cy) ** 2 - r * r;

    const d = b * b - 4 * a * c;
    let points = [];

    if (d >= 0) {
        const tValues = [
            (-b + Math.sqrt(d)) / (2 * a),
            (-b - Math.sqrt(d)) / (2 * a)
        ];

        tValues.forEach(t => {
            if (t >= 0 && t <= 1) {
                points.push([x1 + t * dx, y1 + t * dy]);
            }
        });
    }
    return points;
}

function setupMouseEvents() {
    function handleMouseDown(event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (!isDrawing && lines.length < 2) {
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            startPoint = [glX, glY];
            isDrawing = true;
        }
    }

    function handleMouseMove(event) {
        if (isDrawing) {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            let [glX, glY] = convertToWebGLCoordinates(x, y);
            tempEndPoint = [glX, glY];
            render();
        }
    }

    function handleMouseUp() {
        if (isDrawing && tempEndPoint) {
            lines.push([...startPoint, ...tempEndPoint]);

            if (lines.length === 1) {
                const r = getDist(startPoint, tempEndPoint);
                updateText(textOverlay1, `Circle: center (${startPoint[0].toFixed(2)}, ${startPoint[1].toFixed(2)}) radius = ${r.toFixed(2)}`);
            } 
            else if (lines.length === 2) {
                updateText(textOverlay2, `Line segment: (${lines[1][0].toFixed(2)}, ${lines[1][1].toFixed(2)}) ~ (${lines[1][2].toFixed(2)}, ${lines[1][3].toFixed(2)})`);
                

                intersectionPoints = calculateIntersections(lines[0], lines[1]);
                if (intersectionPoints.length > 0) {
                    let resTxt = `Intersection Points: ${intersectionPoints.length}`;
                    intersectionPoints.forEach((p, i) => {
                        resTxt += ` Point ${i + 1}: (${p[0].toFixed(2)}, ${p[1].toFixed(2)})`;
                    });
                    updateText(textOverlay3, resTxt);
                } else {
                    updateText(textOverlay3, "No intersection");
                }
            }

            isDrawing = false;
            startPoint = null;
            tempEndPoint = null;
            render();
        }
    }

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
}

function generateCircleVertices(center, radius, numSegments = 100) {
    const vertices = [];
    for (let i = 0; i <= numSegments; i++) {
        const theta = (i / numSegments) * 2 * Math.PI;
        vertices.push(center[0] + radius * Math.cos(theta), center[1] + radius * Math.sin(theta));
    }
    return vertices;
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    shader.use();

    lines.forEach((line, i) => {
        if (i === 0) {
            const r = getDist([line[0], line[1]], [line[2], line[3]]);
            const vertices = generateCircleVertices([line[0], line[1]], r);
            shader.setVec4("u_color", [1.0, 0.0, 1.0, 1.0]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
            gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 2);
        } else {
            shader.setVec4("u_color", [0.0, 1.0, 1.0, 1.0]);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(line), gl.STATIC_DRAW);
            gl.drawArrays(gl.LINES, 0, 2);
        }
    });

    if (intersectionPoints.length > 0) {
        shader.setVec4("u_color", [1.0, 1.0, 0.0, 1.0]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(intersectionPoints.flat()), gl.STATIC_DRAW);
        gl.drawArrays(gl.POINTS, 0, intersectionPoints.length);
    }

    if (isDrawing && startPoint && tempEndPoint) {
        shader.setVec4("u_color", [0.5, 0.5, 0.5, 1.0]);
        if (lines.length === 0) {
            const r = getDist(startPoint, tempEndPoint);
            const vertices = generateCircleVertices(startPoint, r);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
            gl.drawArrays(gl.LINE_STRIP, 0, vertices.length / 2);
        } else {
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([...startPoint, ...tempEndPoint]), gl.STATIC_DRAW);
            gl.drawArrays(gl.LINES, 0, 2);
        }
    }

    axes.draw(mat4.create(), mat4.create());
}

async function initShader() {
    const vertexShaderSource = await readShaderFile('shVert.glsl');
    const fragmentShaderSource = await readShaderFile('shFrag.glsl');
    shader = new Shader(gl, vertexShaderSource, fragmentShaderSource);
}

async function main() {
    try {
        if (!initWebGL()) {
            throw new Error('WebGL 초기화 실패');
            return false; 
        }

        await initShader();
        
        setupBuffers();
        shader.use();

        textOverlay1 = setupText(canvas, "", 1);
        textOverlay2 = setupText(canvas, "", 2);
        textOverlay3 = setupText(canvas, "", 3);

        setupMouseEvents();
        
        render();

        return true;
        
    } catch (error) {
        console.error('Failed to initialize program:', error);
        alert('프로그램 초기화에 실패했습니다.');
        return false;
    }
}

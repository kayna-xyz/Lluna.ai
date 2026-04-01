"use client"

import { useEffect, useRef } from "react"

export function GradientCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    const gl = canvas.getContext("webgl")
    if (!gl) {
      console.error("WebGL not supported")
      return
    }

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    gl.viewport(0, 0, canvas.width, canvas.height)

    const vertexShaderSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `

    const fragmentShaderSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;
      
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }
      
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        
        vec2 u = f * f * (3.0 - 2.0 * f);
        
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }
      
      float fbm(vec2 st) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for (int i = 0; i < 6; i++) {
          value += amplitude * noise(st * frequency);
          frequency *= 2.0;
          amplitude *= 0.5;
        }
        
        return value;
      }
      
      float filmGrain(vec2 uv, vec2 resolution, float time) {
        vec2 pixelCoord = uv * resolution;
        return fract(sin(dot(pixelCoord, vec2(12.9898, 78.233)) + time) * 43758.5453123) * 2.0 - 1.0;
      }
      
      vec3 rayleighScattering(vec3 color, float height, float intensity) {
        vec3 lambda = vec3(0.680, 0.550, 0.440);
        vec3 scatterCoeff = 1.0 / pow(lambda, vec3(4.0));
        scatterCoeff = normalize(scatterCoeff);
        float scatter = intensity * (1.0 - height);
        return color + scatterCoeff * scatter;
      }
      
      float mieScattering(float height, float intensity) {
        float mie = intensity * exp(-pow((height - 0.5) * 2.0, 2.0));
        return mie;
      }
      
      void main() {
        vec3 topColor = vec3(0.937, 0.769, 0.667);
        vec3 bottomColor = vec3(0.647, 0.710, 0.745);
        
        vec3 color = mix(topColor, bottomColor, v_uv.y);
        
        float grain = filmGrain(v_uv, u_resolution, u_time);
        color += grain * 0.10;
        
        color = rayleighScattering(color, v_uv.y, 0.08);
        
        float mie = mieScattering(v_uv.y, 0.15);
        color += vec3(mie * 0.8, mie * 0.9, mie);
        
        float atmosphericDepth = 1.0 - (v_uv.y * 0.1);
        color *= atmosphericDepth;
        
        float cloudSpeed = 0.3;
        float cycleDuration = 7.0;
        
        float cycle1 = mod(u_time * cloudSpeed, cycleDuration);
        float cycle2 = mod(u_time * cloudSpeed + 2.67, cycleDuration);
        float cycle3 = mod(u_time * cloudSpeed + 5.33, cycleDuration);
        
        float progress1 = cycle1 / cycleDuration;
        float progress2 = cycle2 / cycleDuration;
        float progress3 = cycle3 / cycleDuration;
        
        float seed1 = floor(u_time * cloudSpeed / cycleDuration);
        float seed2 = floor((u_time * cloudSpeed + 2.67) / cycleDuration);
        float seed3 = floor((u_time * cloudSpeed + 5.33) / cycleDuration);
        
        vec3 cloudTint = vec3(0.98, 0.88, 0.82);
        float totalCloudAlpha = 0.0;
        
        vec2 cloudPos1 = v_uv;
        cloudPos1.x *= u_resolution.x / u_resolution.y;
        
        float cloudX1 = -0.5 + progress1 * 2.5;
        cloudPos1.x -= cloudX1;
        cloudPos1.y -= 0.75;
        
        float width1 = 0.7 + fract(sin(seed1 * 45.164) * 43758.5453) * 0.4;
        cloudPos1.x *= width1;
        cloudPos1.y *= 15.0;
        
        float noise1 = fbm(cloudPos1 * vec2(3.0, 1.0) + vec2(seed1 * 10.0, 0.0));
        float cloud1 = smoothstep(0.4, 0.6, noise1);
        cloud1 *= smoothstep(0.15, 0.05, abs(cloudPos1.y));
        
        float edgeFade1 = smoothstep(-0.5, 0.0, cloudX1) * smoothstep(2.0, 1.5, cloudX1);
        cloud1 *= edgeFade1;
        
        vec2 cloudPos2 = v_uv;
        cloudPos2.x *= u_resolution.x / u_resolution.y;
        
        float cloudX2 = -0.5 + progress2 * 2.5;
        cloudPos2.x -= cloudX2;
        cloudPos2.y -= 0.55;
        
        float width2 = 0.8 + fract(sin(seed2 * 78.233) * 43758.5453) * 0.5;
        cloudPos2.x *= width2;
        cloudPos2.y *= 18.0;
        
        float noise2 = fbm(cloudPos2 * vec2(2.5, 1.0) + vec2(seed2 * 10.0, 0.0));
        float cloud2 = smoothstep(0.42, 0.58, noise2);
        cloud2 *= smoothstep(0.12, 0.04, abs(cloudPos2.y));
        
        float edgeFade2 = smoothstep(-0.5, 0.0, cloudX2) * smoothstep(2.0, 1.5, cloudX2);
        cloud2 *= edgeFade2;
        
        vec2 cloudPos3 = v_uv;
        cloudPos3.x *= u_resolution.x / u_resolution.y;
        
        float cloudX3 = -0.5 + progress3 * 2.5;
        cloudPos3.x -= cloudX3;
        cloudPos3.y -= 0.35;
        
        float width3 = 0.9 + fract(sin(seed3 * 12.9898) * 43758.5453) * 0.3;
        cloudPos3.x *= width3;
        cloudPos3.y *= 16.0;
        
        float noise3 = fbm(cloudPos3 * vec2(2.8, 1.0) + vec2(seed3 * 10.0, 0.0));
        float cloud3 = smoothstep(0.38, 0.62, noise3);
        cloud3 *= smoothstep(0.13, 0.05, abs(cloudPos3.y));
        
        float edgeFade3 = smoothstep(-0.5, 0.0, cloudX3) * smoothstep(2.0, 1.5, cloudX3);
        cloud3 *= edgeFade3;
        
        totalCloudAlpha = max(cloud1, max(cloud2, cloud3));
        color = mix(color, cloudTint, totalCloudAlpha * 0.5);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `

    function compileShader(source: string, type: number) {
      const shader = gl.createShader(type)
      if (!shader) {
        console.error("Failed to create shader")
        return null
      }

      gl.shaderSource(shader, source)
      gl.compileShader(shader)

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }

      return shader
    }

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER)
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER)

    if (!vertexShader || !fragmentShader) {
      console.error("Failed to compile shaders")
      return
    }

    const program = gl.createProgram()
    if (!program) {
      console.error("Failed to create program")
      return
    }

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program))
      return
    }

    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(program, "a_position")
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    gl["useProgram"](program)
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution")
    const timeLocation = gl.getUniformLocation(program, "u_time")
    gl.uniform2f(resolutionLocation, canvas.width, canvas.height)

    let animationFrameId: number
    const startTime = Date.now()

    const render = () => {
      const currentTime = (Date.now() - startTime) * 0.001
      gl.uniform1f(timeLocation, currentTime)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      animationFrameId = requestAnimationFrame(render)
    }

    render()

    const handleResize = () => {
      const newRect = canvas.getBoundingClientRect()
      canvas.width = newRect.width * dpr
      canvas.height = newRect.height * dpr
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
    }

    window.addEventListener("resize", handleResize)
    return () => {
      window.removeEventListener("resize", handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <div className="w-full h-full bg-black">
      <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />
    </div>
  )
}

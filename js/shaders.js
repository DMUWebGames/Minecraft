// js/shaders.js
export const SHADER_CODE = `
    struct Uniforms { 
        mvpMatrix: mat4x4<f32>, 
        time: f32, 
        pad1: f32, 
        pad2: f32, 
        pad3: f32 
    };

    @binding(0) @group(0) var<uniform> uniforms: Uniforms;
    @binding(1) @group(0) var textureSampler: sampler;
    @binding(2) @group(0) var textureData: texture_2d<f32>;

    struct Light {
        pos: vec3<f32>,
        intensity: f32,
    };

    struct LightsBuffer {
        count: u32,
        pad1: u32, pad2: u32, pad3: u32, 
        lights: array<Light, 16>,
    };
    
    @binding(3) @group(0) var<uniform> lightsData: LightsBuffer;

    struct VertexInput {
        @location(0) position: vec3<f32>,
        @location(1) uv: vec2<f32>,
        @location(2) normal: vec3<f32>, 
    };
    struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
        @location(1) normal: vec3<f32>,
        @location(2) worldPos: vec3<f32>, 
    };
    
    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
        output.uv = input.uv;
        output.normal = input.normal;
        output.worldPos = input.position; 
        return output;
    }

    @fragment
    fn fragmentMain(@location(0) uv: vec2<f32>, @location(1) normal: vec3<f32>, @location(2) worldPos: vec3<f32>,) -> @location(0) vec4<f32> {
        var texColor = textureSample(textureData, textureSampler, uv);
        var tileCorner = floor(uv * 4.0) / 4.0;
        var localUv = fract(uv * 4.0);
        var animLocalUv = vec2<f32>(
            localUv.x + uniforms.time * 0.5, 
            localUv.y + sin(localUv.x * 10.0 + uniforms.time * 2.0) * 0.2 
        );
        animLocalUv = fract(animLocalUv); 
        var animUv = tileCorner + (animLocalUv / 4.0);
        let waterColor = textureSample(textureData, textureSampler, animUv);

        if (texColor.a > 0.4 && texColor.a < 0.9) {
            texColor = waterColor; 
        }

        var totalLight = vec3<f32>(0.2, 0.2, 0.2); 
        let sunAngle = uniforms.time * 0.005; 
        var sunDir = normalize(vec3<f32>(cos(sunAngle), sin(sunAngle), 0.2));
        let isDay = sunDir.y > -0.2; 
        let sunColor = select(vec3<f32>(0.05, 0.05, 0.15), vec3<f32>(0.9, 0.8, 0.6), isDay);
        let sunIntensity = select(0.1, 1.0, isDay);
        let sunDiffuse = max(dot(normal, sunDir), 0.0);
        totalLight += sunColor * sunDiffuse * sunIntensity * 0.8; 

        for (var i: u32 = 0u; i < lightsData.count; i++) {
            let light = lightsData.lights[i];
            let toLight = light.pos - worldPos;
            let dist = length(toLight);
            let dir = normalize(toLight);
            let attenuation = light.intensity / (1.0 + dist * dist);
            let diffuse = max(dot(normal, dir), 0.0);
            totalLight += vec3<f32>(1.0, 0.55, 0.1) * diffuse * attenuation;
        }

        let finalLight = clamp(totalLight, vec3<f32>(0.0), vec3<f32>(1.0));
        return vec4<f32>(texColor.rgb * finalLight, texColor.a);
    }
`;
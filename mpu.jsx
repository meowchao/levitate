import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const MPU6050DroneVisualization = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const droneRef = useRef(null);
  const [sensorData, setSensorData] = useState({
    pitch: 0,
    roll: 0,
    yaw: 0,
    accelX: 0,
    accelY: 0,
    accelZ: 0
  });
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  // Initialize Three.js scene
  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Axes helper
    const axesHelper = new THREE.AxesHelper(3);
    scene.add(axesHelper);

    // Create drone
    const drone = new THREE.Group();
    droneRef.current = drone;

    // Drone body (center)
    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.3, 0.8);
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x2196F3 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    drone.add(body);

    // Drone arms
    const armGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
    const armMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });

    const arm1 = new THREE.Mesh(armGeometry, armMaterial);
    arm1.rotation.z = Math.PI / 2;
    arm1.position.set(1, 0, 0);
    drone.add(arm1);

    const arm2 = new THREE.Mesh(armGeometry, armMaterial);
    arm2.rotation.x = Math.PI / 2;
    arm2.position.set(0, 0, 1);
    drone.add(arm2);

    // Propellers
    const propellerGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32);
    const propellerMaterial = new THREE.MeshPhongMaterial({
      color: 0xff5722,
      transparent: true,
      opacity: 0.7
    });

    const positions = [
      [2, 0.2, 0],
      [-2, 0.2, 0],
      [0, 0.2, 2],
      [0, 0.2, -2]
    ];

    positions.forEach(pos => {
      const propeller = new THREE.Mesh(propellerGeometry, propellerMaterial);
      propeller.position.set(...pos);
      propeller.castShadow = true;
      drone.add(propeller);
    });

    // Direction indicator (front)
    const coneGeometry = new THREE.ConeGeometry(0.15, 0.4, 8);
    const coneMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.position.set(0, 0, -0.6);
    cone.rotation.x = Math.PI / 2;
    drone.add(cone);

    drone.position.y = 2;
    scene.add(drone);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Update drone orientation based on sensor data
  useEffect(() => {
    if (droneRef.current) {
      // Convert degrees to radians
      const pitch = (sensorData.pitch * Math.PI) / 180;
      const roll = (sensorData.roll * Math.PI) / 180;
      const yaw = (sensorData.yaw * Math.PI) / 180;

      droneRef.current.rotation.x = pitch;
      droneRef.current.rotation.z = roll;
      droneRef.current.rotation.y = yaw;
    }
  }, [sensorData]);

  // WebSocket connection
  const connectWebSocket = () => {
    // Replace with your Raspberry Pi's IP address
    const ws = new WebSocket('ws://YOUR_RPI_IP:8765');
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      console.log('Connected to MPU6050 sensor');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setSensorData(data);
      } catch (e) {
        console.error('Error parsing sensor data:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };

    ws.onclose = () => {
      setConnected(false);
      console.log('Disconnected from sensor');
    };
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  // Simulate data for demo purposes
  const simulateData = () => {
    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.02;
      setSensorData({
        pitch: Math.sin(angle) * 30,
        roll: Math.cos(angle) * 20,
        yaw: angle * 10,
        accelX: Math.sin(angle) * 2,
        accelY: 1,
        accelZ: Math.cos(angle) * 2
      });
    }, 50);

    return () => clearInterval(interval);
  };

  useEffect(() => {
    const cleanup = simulateData();
    return cleanup;
  }, []);

  return (
    <div className="w-full h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">MPU6050 Drone Visualization</h1>
            <p className="text-gray-400 text-sm">Real-time 6-axis IMU sensor monitoring</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={connectWebSocket}
              disabled={connected}
              className={`px-4 py-2 rounded font-medium ${
                connected
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {connected ? 'Connected' : 'Connect'}
            </button>
            <button
              onClick={disconnectWebSocket}
              disabled={!connected}
              className={`px-4 py-2 rounded font-medium ${
                !connected
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* 3D Visualization */}
        <div className="flex-1 relative">
          <div ref={mountRef} className="w-full h-full" />
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 p-4 rounded text-white">
            <div className="text-xs text-gray-400 mb-2">ORIENTATION</div>
            <div className="space-y-1 font-mono text-sm">
              <div>Pitch: <span className="text-blue-400">{sensorData.pitch.toFixed(2)}°</span></div>
              <div>Roll: <span className="text-green-400">{sensorData.roll.toFixed(2)}°</span></div>
              <div>Yaw: <span className="text-yellow-400">{sensorData.yaw.toFixed(2)}°</span></div>
            </div>
          </div>

          <div className="absolute top-4 right-4 bg-black bg-opacity-70 p-4 rounded text-white">
            <div className="text-xs text-gray-400 mb-2">ACCELERATION (m/s²)</div>
            <div className="space-y-1 font-mono text-sm">
              <div>X: <span className="text-red-400">{sensorData.accelX.toFixed(3)}</span></div>
              <div>Y: <span className="text-green-400">{sensorData.accelY.toFixed(3)}</span></div>
              <div>Z: <span className="text-blue-400">{sensorData.accelZ.toFixed(3)}</span></div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-2 rounded">
            <div className={`flex items-center gap-2 text-sm ${connected ? 'text-green-400' : 'text-yellow-400'}`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
              {connected ? 'Live Data' : 'Demo Mode'}
            </div>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-80 bg-gray-800 p-4 overflow-y-auto">
          <h2 className="text-xl font-bold text-white mb-4">Setup Instructions</h2>

          <div className="space-y-4 text-sm text-gray-300">
            <div className="bg-gray-900 p-3 rounded">
              <h3 className="font-bold text-white mb-2">1. Hardware Setup</h3>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Connect MPU6050 VCC to 3.3V</li>
                <li>Connect GND to Ground</li>
                <li>Connect SDA to GPIO2 (Pin 3)</li>
                <li>Connect SCL to GPIO3 (Pin 5)</li>
              </ul>
            </div>

            <div className="bg-gray-900 p-3 rounded">
              <h3 className="font-bold text-white mb-2">2. Enable I2C</h3>
              <code className="block bg-black p-2 rounded text-xs text-green-400 mt-2">
                sudo raspi-config
              </code>
              <p className="text-xs mt-2">Interface Options → I2C → Enable</p>
            </div>

            <div className="bg-gray-900 p-3 rounded">
              <h3 className="font-bold text-white mb-2">3. Install Python Packages</h3>
              <code className="block bg-black p-2 rounded text-xs text-green-400 mt-2">
                pip install mpu6050-raspberrypi<br/>
                pip install websockets asyncio
              </code>
            </div>

            <div className="bg-gray-900 p-3 rounded">
              <h3 className="font-bold text-white mb-2">4. Python Server Code</h3>
              <p className="text-xs mb-2">Save as mpu6050_server.py on your RPi</p>
              <div className="bg-black p-2 rounded text-xs text-green-400 overflow-x-auto">
                <pre>{`import asyncio
import websockets
import json
from mpu6050 import mpu6050
from time import sleep

sensor = mpu6050(0x68)

async def send_data(websocket):
    while True:
        accel = sensor.get_accel_data()
        gyro = sensor.get_gyro_data()

        data = {
            "pitch": gyro['x'],
            "roll": gyro['y'],
            "yaw": gyro['z'],
            "accelX": accel['x'],
            "accelY": accel['y'],
            "accelZ": accel['z']
        }

        await websocket.send(
            json.dumps(data)
        )
        await asyncio.sleep(0.05)

async def main():
    async with websockets.serve(
        send_data, "0.0.0.0", 8765
    ):
        await asyncio.Future()

asyncio.run(main())`}</pre>
              </div>
            </div>

            <div className="bg-gray-900 p-3 rounded">
              <h3 className="font-bold text-white mb-2">5. Run Server</h3>
              <code className="block bg-black p-2 rounded text-xs text-green-400 mt-2">
                python3 mpu6050_server.py
              </code>
            </div>

            <div className="bg-gray-900 p-3 rounded">
              <h3 className="font-bold text-white mb-2">6. Update Connection</h3>
              <p className="text-xs">Replace YOUR_RPI_IP with your Raspberry Pi's IP address in the code, then click Connect.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MPU6050DroneVisualization;

import asyncio
import websockets
import json
from smbus2 import SMBus
import math

# MPU6050 Configuration
MPU_ADDR = 0x68
PWR_MGMT_1 = 0x6B
ACCEL_XOUT_H = 0x3B
GYRO_XOUT_H = 0x43

bus = SMBus(1)

# Wake up MPU6050
bus.write_byte_data(MPU_ADDR, PWR_MGMT_1, 0)

def read_word(reg):
    """Read 16-bit word from MPU6050"""
    high = bus.read_byte_data(MPU_ADDR, reg)
    low = bus.read_byte_data(MPU_ADDR, reg + 1)
    val = (high << 8) + low
    return val - 65536 if val > 32767 else val

def read_mpu6050():
    """Read accelerometer and gyroscope data"""
    # Accelerometer (in g's)
    ax = read_word(ACCEL_XOUT_H) / 16384.0
    ay = read_word(ACCEL_XOUT_H + 2) / 16384.0
    az = read_word(ACCEL_XOUT_H + 4) / 16384.0

    # Gyroscope (in degrees/sec)
    gx = read_word(GYRO_XOUT_H) / 131.0
    gy = read_word(GYRO_XOUT_H + 2) / 131.0
    gz = read_word(GYRO_XOUT_H + 4) / 131.0

    return ax, ay, az, gx, gy, gz

# Complementary filter variables
pitch = 0.0
roll = 0.0
yaw = 0.0
dt = 0.05  # 50ms update rate

async def send_sensor_data(websocket):
    """Send continuous sensor data to connected client"""
    global pitch, roll, yaw

    print(f"Client connected from: {websocket.remote_address}")

    try:
        while True:
            # Read sensor
            ax, ay, az, gx, gy, gz = read_mpu6050()

            # Calculate pitch and roll from accelerometer
            accel_pitch = math.atan2(ay, math.sqrt(ax**2 + az**2)) * 180 / math.pi
            accel_roll = math.atan2(-ax, az) * 180 / math.pi

            # Complementary filter (98% gyro, 2% accel)
            alpha = 0.98
            pitch = alpha * (pitch + gx * dt) + (1 - alpha) * accel_pitch
            roll = alpha * (roll + gy * dt) + (1 - alpha) * accel_roll
            yaw += gz * dt

            # Prepare JSON data
            data = {
                "pitch": round(pitch, 2),
                "roll": round(roll, 2),
                "yaw": round(yaw, 2),
                "accelX": round(ax, 3),
                "accelY": round(ay, 3),
                "accelZ": round(az, 3),
                "gyroX": round(gx, 2),
                "gyroY": round(gy, 2),
                "gyroZ": round(gz, 2)
            }

            # Send to browser
            await websocket.send(json.dumps(data))

            # Print to console
            print(f"P={pitch:.1f}° R={roll:.1f}° Y={yaw:.1f}° | AX={ax:.2f} AY={ay:.2f} AZ={az:.2f}")

            # Wait before next reading
            await asyncio.sleep(dt)

    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected")
    except Exception as e:
        print(f"Error: {e}")

async def main():
    """Start WebSocket server"""
    print("=" * 50)
    print("MPU6050 WebSocket Server Starting...")
    print("=" * 50)
    print(f"Server running on: ws://0.0.0.0:8765")
    print("Waiting for browser connection...")
    print("Press Ctrl+C to stop")
    print("=" * 50)

    # Create server - works with both old and new websockets versions
    async with websockets.serve(send_sensor_data, "0.0.0.0", 8765):
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n" + "=" * 50)
        print("Server stopped by user")
        print("=" * 50)
    except Exception as e:
        print(f"Server error: {e}")

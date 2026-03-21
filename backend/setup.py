import os
import sys
from dotenv import load_dotenv
import subprocess
import time

print("=" * 70)
print("DR DETECTION API - COMPLETE SETUP WIZARD")
print("=" * 70)
print()

# Step 1: Check if .env file exists
print("STEP 1: Checking for .env file...")
if not os.path.exists('.env'):
    print("❌ ERROR: .env file not found!")
    print("   Create a file named '.env' in D:\\dr detection\\")
    print("   Add your MongoDB connection string to it")
    input("   Press Enter to exit...")
    sys.exit(1)
else:
    print("✅ .env file found!")

# Load environment variables
load_dotenv()

# Step 2: Check MongoDB URI
print("\nSTEP 2: Checking MongoDB connection string...")
mongo_uri = os.getenv("MONGODB_URI")
if not mongo_uri:
    print("❌ ERROR: MONGODB_URI not found in .env file!")
elif "YOUR_PASSWORD_HERE" in mongo_uri:
    print("❌ ERROR: You forgot to replace YOUR_PASSWORD_HERE in .env file!")
    print("   Open .env file and replace YOUR_PASSWORD_HERE with your actual password")
else:
    print("✅ MongoDB URI looks good!")

# Step 3: Check Python packages
print("\nSTEP 3: Checking required packages...")
packages_to_check = [
    ("flask", "Flask"),
    ("torch", "PyTorch"),
    ("pymongo", "PyMongo"),
    ("PIL", "Pillow"),
    ("cv2", "OpenCV"),
    ("dotenv", "python-dotenv")
]

missing_packages = []
for import_name, package_name in packages_to_check:
    try:
        __import__(import_name)
        print(f"   ✅ {package_name}")
    except ImportError:
        print(f"   ❌ {package_name} - MISSING")
        missing_packages.append(package_name)

if missing_packages:
    print(f"\n⚠️  Missing packages: {', '.join(missing_packages)}")
    install = input("Do you want to install them now? (y/n): ")
    if install.lower() == 'y':
        for package in missing_packages:
            if package == "PyTorch":
                print("Installing PyTorch (this may take a few minutes)...")
                subprocess.check_call([sys.executable, "-m", "pip", "install", "torch", "torchvision", "--index-url", "https://download.pytorch.org/whl/cpu"])
            elif package == "OpenCV":
                subprocess.check_call([sys.executable, "-m", "pip", "install", "opencv-python"])
            else:
                subprocess.check_call([sys.executable, "-m", "pip", "install", package.lower()])

# Step 4: Create directories
print("\nSTEP 4: Creating project directories...")
directories = ['static/uploads', 'ml_model', 'test_images']
for directory in directories:
    os.makedirs(directory, exist_ok=True)
    print(f"   ✅ Created: {directory}")

# Step 5: Create requirements.txt
print("\nSTEP 5: Creating requirements.txt...")
requirements = """Flask==2.3.3
Flask-CORS==4.0.0
Flask-PyMongo==2.3.0
torch==2.1.0
torchvision==0.16.0
pymongo==4.5.0
python-dotenv==1.0.0
Pillow==10.1.0
opencv-python==4.8.1.78
numpy==1.24.3
dnspython==2.4.2
"""

with open('requirements.txt', 'w') as f:
    f.write(requirements)
print("✅ requirements.txt created!")

# Final message
print("\n" + "=" * 70)
print("SETUP COMPLETE!")
print("=" * 70)
print("\nNEXT STEPS:")
print("1. Put your PyTorch model (.pth file) in: D:\\dr detection\\ml_model\\")
print("2. Run: python app.py")
print("3. Open browser to: http://localhost:5000")
print("4. Test API at: http://localhost:5000/health")
print("\nTo install all packages at once:")
print("   pip install -r requirements.txt")
print("\nNeed help? Check these common issues:")
print("• Forgot password? Update .env file")
print("• MongoDB connection failed? Check your internet")
print("• Port 5000 busy? Use: python app.py --port 5001")
print("=" * 70)

input("\nPress Enter to finish setup...")
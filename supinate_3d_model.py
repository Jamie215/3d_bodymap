import bpy
import math

def supinate_armature():
    # Ensure you're in pose mode
    bpy.ops.object.mode_set(mode='POSE')

    # Reference the armature
    armature = bpy.context.object.pose
    
    
    # Left Arm & Hand Supination
    l_shoulder_bone = armature.bones.get('shoulder01.L')
    l_shoulder_bone.rotation_mode = 'XYZ'
    l_shoulder_bone.rotation_euler = (math.radians(-15), math.radians(15), math.radians(0))
    l_ua01_bone = armature.bones.get('upperarm01.L')
    l_ua01_bone.rotation_mode = 'XYZ'
    l_ua01_bone.rotation_euler = (math.radians(-15), math.radians(-30), math.radians(-15))
    l_ua02_bone = armature.bones.get('upperarm02.L')
    l_ua02_bone.rotation_mode = 'XYZ'
    l_ua02_bone.rotation_euler = (math.radians(0), math.radians(-5), math.radians(0))
    l_la01_bone = armature.bones.get('lowerarm01.L')
    l_la01_bone.rotation_mode = 'XYZ'
    l_la01_bone.rotation_euler = (math.radians(-15), math.radians(-15), math.radians(0))
    l_la02_bone = armature.bones.get('lowerarm02.L')
    l_la02_bone.rotation_mode = 'XYZ'
    l_la02_bone.rotation_euler = (math.radians(0), math.radians(-45), math.radians(0))
    l_wrist_bone = armature.bones.get('wrist.L')
    l_wrist_bone.rotation_mode = 'XYZ'
    l_wrist_bone.rotation_euler = (math.radians(0), math.radians(0), math.radians(0))
    
    # Right Arm & Hand Supination
    r_shoulder_bone = armature.bones.get('shoulder01.R')
    r_shoulder_bone.rotation_mode = 'XYZ'
    r_shoulder_bone.rotation_euler = (math.radians(-15), math.radians(-15), math.radians(0))
    r_ua01_bone = armature.bones.get('upperarm01.R')
    r_ua01_bone.rotation_mode = 'XYZ'
    r_ua01_bone.rotation_euler = (math.radians(-15), math.radians(30), math.radians(15))
    r_ua02_bone = armature.bones.get('upperarm02.R')
    r_ua02_bone.rotation_mode = 'XYZ'
    r_ua02_bone.rotation_euler = (math.radians(0), math.radians(5), math.radians(0))
    r_la01_bone = armature.bones.get('lowerarm01.R')
    r_la01_bone.rotation_mode = 'XYZ'
    r_la01_bone.rotation_euler = (math.radians(-15), math.radians(15), math.radians(0))
    r_la02_bone = armature.bones.get('lowerarm02.R')
    r_la02_bone.rotation_mode = 'XYZ'
    r_la02_bone.rotation_euler = (math.radians(0), math.radians(45), math.radians(0))
    r_wrist_bone = armature.bones.get('wrist.R')
    r_wrist_bone.rotation_mode = 'XYZ'
    r_wrist_bone.rotation_euler = (math.radians(0), math.radians(0), math.radians(0))
    
    l_foot_bone = armature.bones.get('foot.L')
    l_foot_bone.rotation_mode = 'XYZ'
    l_foot_bone.rotation_euler = (math.radians(75), math.radians(0), math.radians(0))
    
    r_foot_bone = armature.bones.get('foot.R')
    r_foot_bone.rotation_mode = 'XYZ'
    r_foot_bone.rotation_euler = (math.radians(75), math.radians(0), math.radians(0))
    

# Run the function
supinate_armature()

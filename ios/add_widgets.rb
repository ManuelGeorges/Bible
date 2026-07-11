require 'xcodeproj'

# 1. إعداد المسارات
project_path = 'App/App.xcodeproj'
main_target_name = 'App'
widget_name = 'AgiosWidget'
widget_bundle_id = 'com.agios.bible.widget'

# المسارات بالنسبة لمجلد App (حيث يوجد الملف .xcodeproj)
app_entitlements_path = 'App/App.entitlements'
widget_entitlements_path = 'AgiosWidgets.entitlements'
widget_plist_path = 'AgiosWidgets.plist'

puts "Opening project at #{project_path}..."
project = Xcodeproj::Project.open(project_path)

# 2. البحث عن الـ Target الرئيسي
main_target = project.targets.find { |t| t.name == main_target_name }
raise "Main target '#{main_target_name}' not found" unless main_target

# 3. إعداد الـ Widget Target
widget_target = project.targets.find { |t| t.name == widget_name }
unless widget_target
  puts "Creating new widget target: #{widget_name}..."
  widget_target = project.new_target(:app_extension, widget_name, :ios, '14.0')
end

# ضبط الإعدادات لكل الـ Configurations (Debug & Release)
widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = widget_bundle_id
  config.build_settings['PRODUCT_NAME'] = widget_name
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['SKIP_INSTALL'] = 'YES'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = widget_entitlements_path
  config.build_settings['INFOPLIST_FILE'] = widget_plist_path
  config.build_settings['DEVELOPMENT_TEAM'] = 'XMBVV283C4'
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
end

# 4. إضافة الملفات للـ Xcode Project Groups
# بنضيفهم لـ Group اسمه "AgiosWidget" عشان التنظيم
widget_group = project.main_group['AgiosWidget'] || project.main_group.new_group('AgiosWidget')

# إضافة ملف الـ Swift (موجود في ios/App/)
swift_file_path = 'AgiosWidgets.swift'
swift_ref = widget_group.find_file_by_path(swift_file_path) || widget_group.new_file(swift_file_path)

# التأكد من إضافة الملف لمرحلة الـ Build
widget_target.source_build_phase.clear
widget_target.source_build_phase.add_file_reference(swift_ref)

# 5. ربط الويدجت بالتطبيق (Dependency & Embed)
unless main_target.dependencies.any? { |d| d.target && d.target.name == widget_name }
  main_target.add_dependency(widget_target)
end

embed_phase = main_target.copy_files_build_phases.find { |p| p.dst_subfolder_spec == '13' } ||
              main_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.dst_subfolder_spec = '13'

unless embed_phase.files_references.any? { |f| f.path == widget_target.product_reference.path }
  embed_phase.add_file_reference(widget_target.product_reference)
end

# 6. تحديث إعدادات التطبيق الرئيسي
main_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = app_entitlements_path
end

project.save
puts "Successfully configured iOS Project with Widgets!"

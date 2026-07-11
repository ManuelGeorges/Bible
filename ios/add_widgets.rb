require 'xcodeproj'

# المسار إلى ملف المشروع (يتم تشغيل السكريبت من مجلد ios)
project_path = 'App/App.xcodeproj'
project = Xcodeproj::Project.open(project_path)

# 1. تحديد الأهداف
main_target = project.targets.find { |t| t.name == 'App' }
group_name = 'AgiosWidgets'

# 2. إنشاء مجموعة للملفات (Group)
group = project.main_group.find_subpath(group_name, true)

# 3. تحديد المسارات النسبية للملفات
swift_file = 'App/AgiosWidgets.swift'
plist_file = 'App/AgiosWidgets.plist'
widget_entitlements = 'App/AgiosWidgets.entitlements'
app_entitlements = 'App/App/App.entitlements'

# 4. إضافة مراجع الملفات للمشروع
swift_ref = group.new_reference(swift_file)
plist_ref = group.new_reference(plist_file)
entitlements_ref = group.new_reference(widget_entitlements)

# 5. إنشاء الـ Widget Target (Extension)
old_target = project.targets.find { |t| t.name == group_name }
old_target.remove_from_project if old_target

widget_target = project.new_target(:app_extension, group_name, :ios, '14.0')

# 6. ضبط إعدادات البناء والتوقيع للويدجت
widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = "com.agios.bible.AgiosWidgets"
  config.build_settings['INFOPLIST_FILE'] = plist_file
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = widget_entitlements
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '14.0'
  config.build_settings['DEVELOPMENT_TEAM'] = 'XMBVV283C4'
  config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  config.build_settings['SKIP_INSTALL'] = 'YES'
end

# 7. تفعيل الـ App Groups في التطبيق الأساسي بربط ملف الاستحقاقات
main_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = app_entitlements
  config.build_settings['DEVELOPMENT_TEAM'] = 'XMBVV283C4'
end

# 8. إضافة ملف الكود لمرحلة Compile
widget_target.source_build_phase.add_file_reference(swift_ref)

# 9. ربط الويدجت بالتطبيق كـ Dependency
main_target.add_dependency(widget_target)

# 10. إضافة مرحلة Embed App Extensions
embed_phase = main_target.copy_files_build_phases.find { |p| p.symbol_purpose == :plugins } ||
              main_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.symbol_purpose = :plugins
embed_phase.add_file_reference(widget_target.product_reference)

project.save
puts "Successfully configured iOS Project with Widgets and App Groups!"

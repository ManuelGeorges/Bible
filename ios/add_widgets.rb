require 'xcodeproj'

# 1. إعداد المسارات
project_path = 'AgiosBible.xcodeproj'
widget_name = 'AgiosWidget'
widget_bundle_id = 'com.agios.bible.widget'
app_group_id = 'group.com.agios.bible'
app_entitlements = 'AgiosBible/AgiosBible.entitlements'
widget_entitlements = 'AgiosWidget/AgiosWidget.entitlements'

project = Xcodeproj::Project.open(project_path)

# 2. التأكد من وجود الـ App Group في التطبيق الأساسي
main_target = project.targets.find { |t| t.name == 'AgiosBible' }
raise "Main target not found" unless main_target

# 3. إعداد الـ Widget Target
# (نفترض أن الـ Widget مضاف مسبقاً أو يتم إنشاؤه هنا)
widget_target = project.targets.find { |t| t.name == widget_name }
unless widget_target
  widget_target = project.new_target(:app_extension, widget_name, :ios, '14.0')
  widget_target.product_type = 'com.apple.product-type.app-extension'
  widget_target.build_configurations.each do |config|
    config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = widget_bundle_id
    config.build_settings['INFOPLIST_FILE'] = "#{widget_name}/Info.plist"
    config.build_settings['CODE_SIGN_ENTITLEMENTS'] = widget_entitlements
    config.build_settings['DEVELOPMENT_TEAM'] = 'XMBVV283C4'
  end
end

# 4. إضافة الملفات للويدجت
widget_folder = project.main_group.find_subpath(widget_name, true)
swift_file = "#{widget_name}/#{widget_name}.swift"
swift_ref = widget_folder.new_file(swift_file)

# 5. تفعيل الـ App Groups للويدجت
widget_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = widget_entitlements
end

# 6. تحديث إعدادات الـ Build للويدجت
widget_target.build_configurations.each do |config|
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
embed_phase = main_target.copy_files_build_phases.find { |p| p.dst_subfolder_spec == '13' } ||
              main_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.dst_subfolder_spec = '13'
embed_phase.add_file_reference(widget_target.product_reference)

project.save
puts "Successfully configured iOS Project with Widgets and App Groups!"

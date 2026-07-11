require 'xcodeproj'

# 1. إعداد المسارات (تعديل لتناسب Capacitor)
project_path = 'App/App.xcodeproj'
main_target_name = 'App'
widget_name = 'AgiosWidget'
widget_bundle_id = 'com.agios.bible.widget'
app_group_id = 'group.com.agios.bible'

# المسارات بالنسبة لمجلد ios
app_entitlements = 'App/App/App.entitlements'
widget_entitlements = 'App/AgiosWidgets.entitlements'
swift_file = 'App/AgiosWidgets.swift'

puts "Opening project at #{project_path}..."
project = Xcodeproj::Project.open(project_path)

# 2. التأكد من وجود الـ Target الرئيسي
main_target = project.targets.find { |t| t.name == main_target_name }
raise "Main target '#{main_target_name}' not found" unless main_target

# 3. إعداد الـ Widget Target
widget_target = project.targets.find { |t| t.name == widget_name }
unless widget_target
  puts "Creating new widget target: #{widget_name}..."
  widget_target = project.new_target(:app_extension, widget_name, :ios, '14.0')
  widget_target.product_type = 'com.apple.product-type.app-extension'

  widget_target.build_configurations.each do |config|
    config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = widget_bundle_id
    config.build_settings['CODE_SIGN_ENTITLEMENTS'] = widget_entitlements
    config.build_settings['DEVELOPMENT_TEAM'] = 'XMBVV283C4' # تأكد من أن هذا الـ Team ID صحيح
    config.build_settings['SKIP_INSTALL'] = 'YES'
  end
end

# 4. إضافة ملف الكود للويدجت
# بنضيف الملف لمجلد المشروع في Xcode ونربطه بالـ Target
widget_group = project.main_group.find_subpath('App', true)
swift_ref = widget_group.find_file_by_path(File.basename(swift_file)) || widget_group.new_file(File.basename(swift_file))

# 8. إضافة ملف الكود لمرحلة Compile الخاصة بالويدجت
widget_target.source_build_phase.add_file_reference(swift_ref)

# 9. ربط الويدجت بالتطبيق كـ Dependency
unless main_target.dependencies.any? { |d| d.target.name == widget_name }
  main_target.add_dependency(widget_target)
end

# 10. إضافة مرحلة Embed App Extensions
# في Capacitor، بنحتاج نتأكد إن الويدجت بيتنسخ جوه التطبيق
embed_phase = main_target.copy_files_build_phases.find { |p| p.dst_subfolder_spec == '13' } ||
              main_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.dst_subfolder_spec = '13' # 13 تعني مجلد Plugins/Extensions

unless embed_phase.files_references.any? { |f| f.path == widget_target.product_reference.path }
  embed_phase.add_file_reference(widget_target.product_reference)
end

# تحديث إعدادات الـ Entitlements للـ Target الرئيسي
main_target.build_configurations.each do |config|
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = app_entitlements
end

project.save
puts "Successfully configured iOS Project with Widgets and App Groups!"

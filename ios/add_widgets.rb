require 'xcodeproj'

# 1. إعداد المسارات
project_path = 'App/App.xcodeproj'
main_target_name = 'App'
widget_name = 'AgiosWidget'
# Ensuring this matches the screenshot EXACTLY
widget_bundle_id = 'com.agios.bible.AgiosWidgets'
team_id = 'XMBVV283C4'

# أسماء البروفايلات
main_profile_name = 'Agios Bible ios_app_store 1783793473'
widget_profile_name = 'Agios Widget ios_app_store 1783793474'

# المسارات
app_entitlements_path = 'App/App.entitlements'
widget_entitlements_path = 'AgiosWidgets.entitlements'
widget_plist_path = 'AgiosWidgets.plist'
swift_file_path = 'AgiosWidgets.swift'

puts "Opening project at #{project_path}..."
project = Xcodeproj::Project.open(project_path)

# 2. إعداد الـ Widget Target
widget_target = project.targets.find { |t| t.name == widget_name } || project.new_target(:app_extension, widget_name, :ios, '14.0')

widget_target.build_configurations.each do |config|
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = widget_bundle_id
  config.build_settings['PRODUCT_NAME'] = widget_name
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['SKIP_INSTALL'] = 'YES'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = widget_entitlements_path
  config.build_settings['INFOPLIST_FILE'] = widget_plist_path
  config.build_settings['DEVELOPMENT_TEAM'] = team_id
  config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = widget_profile_name
  config.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
  config.build_settings['LD_RUNPATH_SEARCH_PATHS'] = '$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks'
  # Force matching the bundle ID in the target properties
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES' if config.build_settings['INFOPLIST_FILE'].nil?
end

# 3. إعداد الـ Main Target (Parent)
main_target = project.targets.find { |t| t.name == main_target_name }
main_target.build_configurations.each do |config|
  # Ensure parent bundle ID is exactly 'com.agios.bible'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.agios.bible'
  config.build_settings['CODE_SIGN_ENTITLEMENTS'] = app_entitlements_path
  config.build_settings['CODE_SIGN_STYLE'] = 'Manual'
  config.build_settings['DEVELOPMENT_TEAM'] = team_id
  config.build_settings['PROVISIONING_PROFILE_SPECIFIER'] = main_profile_name
  config.build_settings['CODE_SIGN_IDENTITY'] = 'Apple Distribution'
end

# 4. إضافة الملفات للمشروع
main_group = project.main_group
swift_ref = main_group.find_file_by_path(swift_file_path) || main_group.new_file(swift_file_path)

# ربط ملف الـ Swift بالويدجت
widget_target.source_build_phase.clear
widget_target.source_build_phase.add_file_reference(swift_ref)

# 5. التبعيات (Dependencies)
unless main_target.dependencies.any? { |d| d.target && d.target.name == widget_name }
  main_target.add_dependency(widget_target)
end

# 6. Embed App Extension (Crucial for the "prefixed" check)
embed_phase = main_target.copy_files_build_phases.find { |p| p.dst_subfolder_spec == '13' } ||
              main_target.new_copy_files_build_phase('Embed App Extensions')
embed_phase.dst_subfolder_spec = '13'

unless embed_phase.files_references.any? { |f| f.path == widget_target.product_reference.path }
  embed_phase.add_file_reference(widget_target.product_reference)
end

project.save
puts "Successfully configured iOS Project. Parent: com.agios.bible, Widget: #{widget_bundle_id}"

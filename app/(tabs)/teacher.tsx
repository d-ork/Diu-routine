import { View, Text } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function TeacherScreen() {
  return (
    <ScreenContainer className="px-6 py-6">
      <View className="flex-1 items-center justify-center">
        {/* Header */}
        <View className="mb-8">
          <Text className="text-3xl font-bold text-foreground text-center">Teacher</Text>
          <Text className="text-base text-muted mt-1 text-center">
            Find teacher schedules
          </Text>
        </View>

        {/* Under Maintenance Card */}
        <View className="w-full max-w-md bg-surface rounded-2xl p-8 border border-border items-center">
          <Text className="text-6xl mb-4">🔧</Text>
          <Text className="text-2xl font-bold text-foreground mb-3 text-center">
            Under Maintenance
          </Text>
          <Text className="text-base text-muted text-center leading-relaxed">
            We're currently fixing some issues with the teacher search functionality. This feature will be back soon!
          </Text>
          <View className="mt-6 bg-primary/10 rounded-lg px-4 py-3 w-full">
            <Text className="text-sm text-primary text-center font-semibold">
              Thank you for your patience 🙏
            </Text>
          </View>
        </View>

        {/* Info */}
        <View className="mt-8 px-4">
          <Text className="text-xs text-muted text-center">
            In the meantime, you can use the Student tab to view class schedules
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

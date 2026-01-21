import { View, Text } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function EmptyScreen() {
  return (
    <ScreenContainer className="px-6 py-6 items-center justify-center">
      <Text className="text-6xl mb-4">🚧</Text>
      <Text className="text-2xl font-bold text-foreground mb-2">
        Coming Soon
      </Text>
      <Text className="text-base text-muted text-center">
        This feature is under development
      </Text>
    </ScreenContainer>
  );
}

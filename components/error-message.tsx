import { View, Text } from "react-native";

interface ErrorMessageProps {
  title?: string;
  message: string;
  suggestion?: string;
}

export function ErrorMessage({ title = "Error", message, suggestion }: ErrorMessageProps) {
  return (
    <View className="bg-error/10 border border-error/30 rounded-2xl p-6 mx-4 mt-6">
      <View className="flex-row items-center mb-2">
        <Text className="text-2xl mr-2">⚠️</Text>
        <Text className="text-lg font-bold text-error">{title}</Text>
      </View>
      <Text className="text-sm text-foreground leading-relaxed mb-3">
        {message}
      </Text>
      {suggestion && (
        <View className="bg-surface rounded-xl p-3 mt-2">
          <Text className="text-xs font-semibold text-muted mb-1">💡 SUGGESTION</Text>
          <Text className="text-sm text-foreground">{suggestion}</Text>
        </View>
      )}
    </View>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
}

export function EmptyState({ icon = "📭", title, message }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-6xl mb-4">{icon}</Text>
      <Text className="text-xl font-bold text-foreground mb-2">{title}</Text>
      <Text className="text-sm text-muted text-center leading-relaxed">
        {message}
      </Text>
    </View>
  );
}

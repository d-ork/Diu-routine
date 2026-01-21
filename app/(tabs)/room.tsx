import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";
import { DAYS } from "@/types";

export default function RoomScreen() {
  const colors = useColors();
  const [searchQuery, setSearchQuery] = useState("");
  const [pdfUrl, setPdfUrl] = useState("https://daffodilvarsity.edu.bd/noticeFile/cse-class-routine-spring-2026-v1-8d732090c2.pdf");
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [selectedDay, setSelectedDay] = useState<string>("Saturday");

  // Fetch room schedule
  const {
    data: scheduleData,
    isLoading,
    refetch,
  } = trpc.diu.getRoomSchedule.useQuery(
    {
      pdfUrl,
      room: searchQuery,
    },
    {
      enabled: searchQuery.length >= 3,
    }
  );

  const schedules = scheduleData?.schedules || [];
  const groupedByDay = scheduleData?.groupedByDay || {};
  const stats = scheduleData?.stats;

  const handleSearch = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    refetch();
  };

  const renderStats = () => {
    if (!stats) return null;

    return (
      <View className="flex-row gap-3 mb-6">
        <View className="flex-1 bg-surface rounded-2xl p-4 items-center border border-border">
          <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center mb-2">
            <Text className="text-2xl">📅</Text>
          </View>
          <Text className="text-2xl font-bold text-foreground">
            {stats.totalClasses}
          </Text>
          <Text className="text-xs text-muted mt-1">TOTAL CLASSES</Text>
        </View>

        <View className="flex-1 bg-surface rounded-2xl p-4 items-center border border-border">
          <View className="w-12 h-12 rounded-full bg-error/20 items-center justify-center mb-2">
            <Text className="text-2xl">🔥</Text>
          </View>
          <Text className="text-lg font-bold text-foreground">
            {stats.busiestDay.day.slice(0, 3)}
          </Text>
          <Text className="text-xs text-muted mt-1">
            BUSIEST DAY ({stats.busiestDay.count})
          </Text>
        </View>

        <View className="flex-1 bg-surface rounded-2xl p-4 items-center border border-border">
          <View className="w-12 h-12 rounded-full bg-success/20 items-center justify-center mb-2">
            <Text className="text-2xl">🍃</Text>
          </View>
          <Text className="text-lg font-bold text-foreground">
            {stats.lightestDay.day.slice(0, 3)}
          </Text>
          <Text className="text-xs text-muted mt-1">
            LIGHTEST DAY ({stats.lightestDay.count})
          </Text>
        </View>
      </View>
    );
  };

  const renderWeekView = () => {
    const timeSlots = ["08:30-10:00", "10:00-11:30", "11:30-01:00", "01:00-02:30", "02:30-04:00"];

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header */}
          <View className="flex-row mb-2">
            <View className="w-24 h-12 items-center justify-center">
              <Text className="text-xs font-bold text-muted">DAY</Text>
            </View>
            {timeSlots.map((slot) => (
              <View key={slot} className="w-32 h-12 items-center justify-center border-l border-border">
                <Text className="text-xs font-semibold text-foreground">{slot}</Text>
              </View>
            ))}
          </View>

          {/* Days */}
          {DAYS.map((day) => {
            const daySchedules = groupedByDay[day] || [];
            return (
              <View key={day} className="flex-row mb-2">
                <View className="w-24 h-20 items-center justify-center bg-surface rounded-l-xl border border-border">
                  <Text className="text-sm font-bold text-foreground">{day.slice(0, 3)}</Text>
                </View>
                {timeSlots.map((slot) => {
                  const classInSlot = daySchedules.find((s) =>
                    slot.includes(s.timeStart)
                  );
                  return (
                    <View
                      key={`${day}-${slot}`}
                      className="w-32 h-20 border-l border-border items-center justify-center bg-surface"
                    >
                      {classInSlot ? (
                        <View className="bg-primary/20 rounded-lg p-2 w-full">
                          <Text className="text-xs font-bold text-primary">
                            {classInSlot.courseCode}
                          </Text>
                          <Text className="text-xs text-foreground mt-1">
                            {classInSlot.batch}_{classInSlot.section}
                          </Text>
                          <Text className="text-xs text-muted">
                            {classInSlot.teacherInitials}
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-xs text-muted">—</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderDayView = () => {
    const daySchedules = groupedByDay[selectedDay] || [];

    return (
      <View>
        {/* Day selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          <View className="flex-row gap-2">
            {DAYS.map((day) => (
              <TouchableOpacity
                key={day}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.7}
                className={`px-6 py-3 rounded-xl ${
                  selectedDay === day ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selectedDay === day ? "text-background" : "text-foreground"
                  }`}
                >
                  {day.slice(0, 3)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Classes */}
        {daySchedules.length === 0 ? (
          <View className="bg-surface rounded-2xl p-6 items-center border border-border">
            <Text className="text-4xl mb-2">🚪</Text>
            <Text className="text-base text-foreground font-medium">Room Empty</Text>
            <Text className="text-sm text-muted mt-1">No classes scheduled</Text>
          </View>
        ) : (
          daySchedules.map((schedule, index) => (
            <View
              key={index}
              className="bg-surface rounded-2xl p-4 mb-3 border border-border"
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">
                    {schedule.courseName}
                  </Text>
                  <Text className="text-sm text-primary mt-1">
                    {schedule.courseCode}
                  </Text>
                </View>
                <View className="bg-primary/20 rounded-full px-3 py-1">
                  <Text className="text-xs font-bold text-primary">
                    {schedule.timeStart} - {schedule.timeEnd}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-4 mt-2">
                <View className="flex-row items-center">
                  <Text className="text-sm text-muted">
                    👥 {schedule.batch}_{schedule.section}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-sm text-muted">
                    👨‍🏫 {schedule.teacherInitials}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  return (
    <ScreenContainer className="px-6 py-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Room</Text>
          <Text className="text-base text-muted mt-1">
            Check room availability
          </Text>
        </View>

        {/* Search */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2">
            <View className="flex-1 bg-surface rounded-xl border border-border px-4 py-3 flex-row items-center">
              <Text className="text-muted mr-2">🔍</Text>
              <TextInput
                className="flex-1 text-base text-foreground"
                placeholder="Enter room number (e.g., KT-222)"
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="characters"
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
            </View>
            <TouchableOpacity
              onPress={handleSearch}
              activeOpacity={0.7}
              className="bg-primary rounded-xl px-6 py-3"
              disabled={isLoading}
            >
              <Text className="text-base font-semibold text-background">
                {isLoading ? "..." : "Find"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Results */}
        {isLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-base text-muted mt-4">Loading schedule...</Text>
          </View>
        ) : schedules.length > 0 ? (
          <>
            {/* Stats */}
            {renderStats()}

            {/* View Toggle */}
            <View className="flex-row gap-2 mb-6">
              <TouchableOpacity
                onPress={() => setViewMode("day")}
                activeOpacity={0.7}
                className={`flex-1 py-3 rounded-xl ${
                  viewMode === "day" ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`text-center text-base font-semibold ${
                    viewMode === "day" ? "text-background" : "text-foreground"
                  }`}
                >
                  📅 Day View
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewMode("week")}
                activeOpacity={0.7}
                className={`flex-1 py-3 rounded-xl ${
                  viewMode === "week" ? "bg-primary" : "bg-surface border border-border"
                }`}
              >
                <Text
                  className={`text-center text-base font-semibold ${
                    viewMode === "week" ? "text-background" : "text-foreground"
                  }`}
                >
                  📆 Week View
                </Text>
              </TouchableOpacity>
            </View>

            {/* Content */}
            {viewMode === "week" ? renderWeekView() : renderDayView()}
          </>
        ) : searchQuery.length >= 3 ? (
          <View className="bg-surface rounded-2xl p-6 items-center border border-border">
            <Text className="text-4xl mb-2">🔍</Text>
            <Text className="text-base text-foreground font-medium">
              No Results Found
            </Text>
            <Text className="text-sm text-muted mt-1 text-center">
              Try a different room number
            </Text>
          </View>
        ) : (
          <View className="bg-surface rounded-2xl p-6 items-center border border-border">
            <Text className="text-4xl mb-2">👋</Text>
            <Text className="text-base text-foreground font-medium">
              Welcome!
            </Text>
            <Text className="text-sm text-muted mt-1 text-center">
              Enter a room number to view its schedule
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

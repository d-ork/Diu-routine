import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  Pressable,
  Clipboard,
  RefreshControl,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { ErrorMessage, EmptyState } from "@/components/error-message";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useThemeContext } from "@/lib/theme-provider";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";
import type { ClassSchedule, Faculty } from "@/types";
import { DAYS } from "@/types";

export default function StudentScreen() {
  const colors = useColors();
  const { colorScheme, setColorScheme } = useThemeContext();
  
  const toggleColorScheme = () => {
    setColorScheme(colorScheme === "dark" ? "light" : "dark");
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [department, setDepartment] = useState("cse");
  const [pdfUrl, setPdfUrl] = useState("https://daffodilvarsity.edu.bd/noticeFile/cse-class-routine-spring-2026-v1-8d732090c2.pdf");
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [selectedDay, setSelectedDay] = useState<string>("Saturday");
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasLoadedSavedSection, setHasLoadedSavedSection] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<Faculty | null>(null);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [cachedSchedule, setCachedSchedule] = useState<any>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  // Load saved batch_section on mount
  useEffect(() => {
    const loadSavedSection = async () => {
      try {
        const saved = await AsyncStorage.getItem('saved_batch_section');
        if (saved && !hasLoadedSavedSection) {
          setSearchQuery(saved);
          setHasLoadedSavedSection(true);
        }
      } catch (error) {
        console.error('Failed to load saved section:', error);
      }
    };
    loadSavedSection();
  }, []);

  const departments = [
    { code: "cse", name: "CSE" },
    { code: "eee", name: "EEE" },
    { code: "swe", name: "SWE" },
    { code: "ags", name: "AGS" },
    { code: "ce", name: "CE" },
    { code: "mct", name: "MCT" },
    { code: "ice", name: "ICE" },
    { code: "architecture", name: "Architecture" },
  ];

  // Auto-fetch latest PDF URL when department changes
  const { data: latestPdfData } = trpc.diu.getLatestPdfUrl.useQuery(
    { department },
    { enabled: true }
  );

  // Get all batch_sections for autocomplete
  const { data: batchSectionsData } = trpc.diu.getAllBatchSections.useQuery(
    { department, pdfUrl },
    { enabled: !!pdfUrl }
  );

  // Clear cache mutation
  const clearCacheMutation = trpc.diu.clearCache.useMutation();

  // Update PDF URL when latest is fetched and clear old caches
  useEffect(() => {
    const updatePdfAndClearCache = async () => {
      if (latestPdfData?.pdfUrl && latestPdfData.pdfUrl !== pdfUrl) {
        // PDF URL changed, clear all old caches for this department
        try {
          const keys = await AsyncStorage.getAllKeys();
          const oldCacheKeys = keys.filter(key => 
            key.startsWith(`schedule_${department}_`) && 
            !key.includes(latestPdfData.pdfUrl.split('/').pop()?.split('.')[0] || '')
          );
          if (oldCacheKeys.length > 0) {
            await AsyncStorage.multiRemove(oldCacheKeys);
            console.log(`Cleared ${oldCacheKeys.length} old caches for ${department}`);
          }
        } catch (error) {
          console.error('Failed to clear old caches:', error);
        }
        setPdfUrl(latestPdfData.pdfUrl);
      }
    };
    updatePdfAndClearCache();
  }, [latestPdfData, pdfUrl, department]);

  // Load last searched batch_section on mount
  useEffect(() => {
    const loadLastSearch = async () => {
      try {
        const lastSearch = await AsyncStorage.getItem("lastBatchSection");
        if (lastSearch) {
          setSearchQuery(lastSearch);
        }
      } catch (error) {
        console.error("Failed to load last search:", error);
      }
    };
    loadLastSearch();
  }, []);

  // Save search query when it changes
  useEffect(() => {
    const saveSearch = async () => {
      if (searchQuery.length >= 3) {
        try {
          await AsyncStorage.setItem("lastBatchSection", searchQuery);
        } catch (error) {
          console.error("Failed to save search:", error);
        }
      }
    };
    saveSearch();
  }, [searchQuery]);

  // Load cached schedule on mount
  useEffect(() => {
    const loadCache = async () => {
      if (searchQuery.length >= 3) {
        try {
          // Include PDF URL in cache key to prevent conflicts
          const pdfHash = pdfUrl.split('/').pop()?.split('.')[0] || 'default';
          const cacheKey = `schedule_${department}_${searchQuery}_${pdfHash}`;
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            // Verify cache is for the same PDF URL
            if (parsed.pdfUrl === pdfUrl) {
              setCachedSchedule(parsed.data);
              setCacheTimestamp(parsed.timestamp);
              setShouldFetch(false); // Don't fetch if cache exists
            } else {
              // PDF changed, clear old cache and fetch new
              await AsyncStorage.removeItem(cacheKey);
              setShouldFetch(true);
            }
          } else {
            setShouldFetch(true); // Fetch if no cache
          }
        } catch (error) {
          console.error('Failed to load cache:', error);
          setShouldFetch(true); // Fetch on error
        }
      }
    };
    loadCache();
  }, [searchQuery, department, pdfUrl]);

  // Fetch student schedule (only when cache doesn't exist or explicitly requested)
  const {
    data: scheduleData,
    isLoading,
    error,
    refetch,
  } = trpc.diu.getStudentSchedule.useQuery(
    {
      pdfUrl,
      batchSection: searchQuery,
    },
    {
      enabled: searchQuery.length >= 3 && shouldFetch, // Only fetch when no cache or explicitly requested
      retry: 1,
    }
  );

  // Cache schedule data when it arrives
  useEffect(() => {
    const saveCache = async () => {
      if (scheduleData && searchQuery.length >= 3) {
        try {
          // Include PDF URL in cache key to prevent conflicts
          const pdfHash = pdfUrl.split('/').pop()?.split('.')[0] || 'default';
          const cacheKey = `schedule_${department}_${searchQuery}_${pdfHash}`;
          const cacheData = {
            data: scheduleData,
            timestamp: new Date().toISOString(),
            pdfUrl: pdfUrl, // Store PDF URL for validation
          };
          await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
          setCachedSchedule(scheduleData);
          setCacheTimestamp(cacheData.timestamp);
        } catch (error) {
          console.error('Failed to save cache:', error);
        }
      }
    };
    saveCache();
  }, [scheduleData, searchQuery, department, pdfUrl]);

  // Fetch faculty data
  const { data: facultyData } = trpc.diu.scrapeFaculty.useQuery({
    department: "cse",
  });

  // Map database faculty to frontend Faculty type (fullName -> name)
  const faculty = (facultyData?.faculty || []).map((f: any) => ({
    ...f,
    name: f.fullName,
    id: f.initials,
    department: f.department.toUpperCase(),
  }));
  // Use cached data if available, otherwise use fresh data
  const displayData = cachedSchedule || scheduleData;
  const schedules = displayData?.classes || [];
  const groupedByDay = displayData?.schedule || {};
  const stats = displayData?.stats;

  const handleSearch = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    // Save batch_section to AsyncStorage
    try {
      await AsyncStorage.setItem('saved_batch_section', searchQuery);
    } catch (error) {
      console.error('Failed to save section:', error);
    }
    // Enable fetching when user explicitly searches
    setShouldFetch(true);
    refetch();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Clear cache for this section
    try {
      const pdfHash = pdfUrl.split('/').pop()?.split('.')[0] || 'default';
      const cacheKey = `schedule_${department}_${searchQuery}_${pdfHash}`;
      await AsyncStorage.removeItem(cacheKey);
      setCachedSchedule(null);
      setShouldFetch(true); // Enable fetching
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
    await refetch();
    setIsRefreshing(false);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const getFacultyByInitials = (initials: string): Faculty | undefined => {
    return faculty.find((f) => f.initials === initials);
  };

  const handleTeacherClick = (initials: string) => {
    console.log('Teacher clicked:', initials);
    console.log('Faculty data:', faculty.length, 'teachers');
    const teacher = getFacultyByInitials(initials);
    console.log('Found teacher:', teacher);
    if (teacher) {
      setSelectedTeacher(teacher);
      setShowTeacherModal(true);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      console.log('Teacher not found in faculty data');
      // Show modal anyway with just the initials
      setSelectedTeacher({
        initials,
        name: 'Teacher information not available',
        designation: '',
        email: '',
        phone: '',
        room: '',
        photoUrl: ''
      } as Faculty);
      setShowTeacherModal(true);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setString(text);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // Could add a toast notification here
  };

  const isClassOngoing = (timeStart: string, timeEnd: string, day: string): boolean => {
    const now = new Date();
    const currentDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];
    
    if (day !== currentDay) return false;
    
    const parseTime = (timeStr: string) => {
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };
    
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = parseTime(timeStart);
    const endMinutes = parseTime(timeEnd);
    
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  };

  const renderFacultyPhotos = () => {
    if (schedules.length === 0) return null;

    // Get unique teacher initials from schedules
    const uniqueTeachers = Array.from(
      new Set(schedules.map((s) => s.teacher))
    );

    return (
      <View className="mb-6">
        <Text className="text-sm font-semibold text-foreground mb-3">
          YOUR TEACHERS
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-4">
            {uniqueTeachers.map((initials) => {
              const facultyMember = getFacultyByInitials(initials);
              return (
                <View key={initials} className="items-center">
                  <View className="w-16 h-16 rounded-full bg-surface border-2 border-primary items-center justify-center overflow-hidden">
                    {facultyMember?.photoUrl ? (
                      <Image
                        source={{ uri: facultyMember.photoUrl }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Text className="text-lg font-bold text-primary">
                        {initials}
                      </Text>
                    )}
                  </View>
                  <Text className="text-xs text-foreground mt-2 font-medium">
                    {initials}
                  </Text>
                  {facultyMember && (
                    <Text className="text-xs text-muted text-center max-w-[80px]" numberOfLines={2}>
                      {facultyMember.name}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
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
            {stats.busiestDay.slice(0, 3)}
          </Text>
          <Text className="text-xs text-muted mt-1">
            BUSIEST DAY ({stats.busiestDayCount})
          </Text>
        </View>

        <View className="flex-1 bg-surface rounded-2xl p-4 items-center border border-border">
          <View className="w-12 h-12 rounded-full bg-success/20 items-center justify-center mb-2">
            <Text className="text-2xl">🍃</Text>
          </View>
          <Text className="text-lg font-bold text-foreground">
            {stats.lightestDay.slice(0, 3)}
          </Text>
          <Text className="text-xs text-muted mt-1">
            LIGHTEST DAY ({stats.lightestDayCount})
          </Text>
        </View>
      </View>
    );
  };

  // Get current week dates for day headers
  const getWeekDates = () => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 6 = Saturday
    const saturday = new Date(today);
    // Find the upcoming Saturday (start of next academic week)
    // Always show the next Saturday onwards for future planning
    if (currentDay === 6) {
      // Today is Saturday, use today
    } else {
      // Go forward to next Saturday
      // Sunday (0) -> forward 6 days, Monday (1) -> forward 5 days, ..., Friday (5) -> forward 1 day
      const daysToGoForward = currentDay === 0 ? 6 : 6 - currentDay;
      saturday.setDate(today.getDate() + daysToGoForward);
    }
    
    const dates: Record<string, number> = {};
    DAYS.forEach((day, index) => {
      const date = new Date(saturday);
      date.setDate(saturday.getDate() + index);
      dates[day] = date.getDate();
    });
    return dates;
  };

  const weekDates = getWeekDates();

  // Format timestamp for display
  const formatTimestamp = (parsedAt?: Date | string) => {
    if (!parsedAt) return "Updated recently";
    
    const now = new Date();
    const parsed = typeof parsedAt === "string" ? new Date(parsedAt) : parsedAt;
    const diffMs = now.getTime() - parsed.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return "Updated just now";
    if (diffMins < 60) return `Updated ${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
    if (diffHours < 24) return `Updated ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    return `Updated ${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  };

  // Get color for course type
  const getCourseColor = (courseCode: string) => {
    const prefix = courseCode.match(/^[A-Z]+/)?.[0] || "";
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      CSE: { bg: "bg-blue-500", text: "text-white", border: "#3B82F6" },
      MAT: { bg: "bg-green-500", text: "text-white", border: "#10B981" },
      ENG: { bg: "bg-orange-500", text: "text-white", border: "#F97316" },
      BNS: { bg: "bg-purple-500", text: "text-white", border: "#A855F7" },
    };
    return colorMap[prefix] || { bg: "bg-primary", text: "text-white", border: "#0a7ea4" };
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
                  <Text className="text-base font-bold text-muted mt-1">{weekDates[day]}</Text>
                </View>
                {timeSlots.map((slot) => {
                  const slotStart = slot.split('-')[0];
                  const classInSlot = daySchedules.find((s) =>
                    s.timeStart === slotStart
                  );
                  return (
                    <View
                      key={`${day}-${slot}`}
                      className="w-32 h-20 border-l border-border items-center justify-center bg-surface"
                    >
                      {classInSlot ? (() => {
                        const colors = getCourseColor(classInSlot.courseCode);
                        return (
                        <View className={`${colors.bg} rounded-lg p-2 w-full`}>
                          <Text className="text-xs font-bold" style={{ color: '#FFFFFF' }}>
                            {classInSlot.courseCode}
                          </Text>
                          <Text className="text-xs mt-1" style={{ color: '#FFFFFF', opacity: 0.9 }}>
                            {classInSlot.room}
                          </Text>
                          <TouchableOpacity 
                            onPress={() => handleTeacherClick(classInSlot.teacher)}
                            activeOpacity={0.6}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          >
                            <Text className="text-xs" style={{ color: '#FFFFFF', opacity: 0.8, textDecorationLine: 'underline' }}>
                              👨‍🏫 {classInSlot.teacher}
                            </Text>
                          </TouchableOpacity>
                        </View>
                        );
                      })() : (
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
            {DAYS.map((day, index) => {
              const dateNum = weekDates[day];
              return (
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
                <Text
                  className={`text-sm font-bold mt-1 ${
                    selectedDay === day ? "text-background opacity-80" : "text-muted"
                  }`}
                >
                  {dateNum}
                </Text>
              </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Classes */}
        {daySchedules.length === 0 ? (
          <View className="bg-surface rounded-2xl p-6 items-center border border-border">
            <Text className="text-4xl mb-2">😴</Text>
            <Text className="text-base text-foreground font-medium">No Classes</Text>
            <Text className="text-sm text-muted mt-1">Enjoy your day off!</Text>
          </View>
        ) : (
          daySchedules
            .sort((a, b) => {
              // Convert time to minutes for proper sorting (e.g., "08:30" -> 510, "01:00" -> 780)
              const timeToMinutes = (time: string) => {
                const [hours, mins] = time.split(':').map(Number);
                // Handle PM times (01:00 PM = 13:00 in 24hr)
                const adjustedHours = hours < 8 ? hours + 12 : hours;
                return adjustedHours * 60 + mins;
              };
              return timeToMinutes(a.timeStart) - timeToMinutes(b.timeStart);
            })
            .flatMap((schedule, index, array) => {
              const elements = [];
              const colors = getCourseColor(schedule.courseCode);
              const isOngoing = isClassOngoing(schedule.timeStart, schedule.timeEnd, schedule.day);
              
              // Add class card
              elements.push(
            <View
              key={`class-${index}`}
              className="bg-surface rounded-2xl p-4 mb-3 border border-border"
              style={{ 
                borderLeftWidth: 4, 
                borderLeftColor: colors.border,
                borderWidth: isOngoing ? 2 : 0,
                borderColor: isOngoing ? colors.border : 'transparent'
              }}
            >
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1">
                  <Text className="text-lg font-bold text-foreground">
                    {schedule.courseName}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-1">
                    <View className={`${getCourseColor(schedule.courseCode).bg} rounded-lg px-2 py-1 self-start`}>
                      <Text className={`text-xs font-bold ${getCourseColor(schedule.courseCode).text}`}>
                        {schedule.courseCode}
                      </Text>
                    </View>
                    {isOngoing && (
                      <View className="bg-green-500 rounded-full px-2 py-1">
                        <Text className="text-xs font-bold text-white">▶️ Now</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View className="bg-primary/20 rounded-full px-3 py-1.5">
                  <Text className="text-sm font-bold text-primary">
                    {schedule.timeStart} - {schedule.timeEnd}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-4 mt-2">
                <View className="flex-row items-center">
                  <Text className="text-sm text-muted">📍 {schedule.room}</Text>
                </View>
                <View className="flex-row items-center">
                  <Text className="text-sm text-muted">👨‍🏫 </Text>
                  <TouchableOpacity 
                    onPress={() => handleTeacherClick(schedule.teacher)}
                    activeOpacity={0.6}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text className="text-sm text-primary font-semibold">
                      {schedule.teacher}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="mt-2">
                <Text className="text-xs text-muted">
                  Section: {schedule.batch}_{schedule.section}
                </Text>
              </View>
            </View>
              );
              
              // Check if there's a break before the next class
              if (index < array.length - 1) {
                const nextClass = array[index + 1];
                const currentEndTime = schedule.timeEnd;
                const nextStartTime = nextClass.timeStart;
                
                // If there's a gap between classes, add a break card
                if (currentEndTime !== nextStartTime) {
                  elements.push(
                    <View
                      key={`break-${index}`}
                      className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-4 mb-3 border border-gray-300 dark:border-gray-700 items-center"
                    >
                      <Text className="text-2xl mb-1">☕</Text>
                      <Text className="text-base font-semibold text-gray-600 dark:text-gray-300">Break Time</Text>
                      <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {currentEndTime} - {nextStartTime}
                      </Text>
                    </View>
                  );
                }
              }
              
              return elements;
            }).flat()
        )}
      </View>
    );
  };

  return (
    <ScreenContainer className="px-6 py-6">
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View className="mb-6 flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-3xl font-bold text-foreground">Student</Text>
            <Text className="text-base text-muted mt-1">
              Find your class schedule
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              toggleColorScheme();
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            activeOpacity={0.7}
            className="bg-surface rounded-full p-3 border border-border"
          >
            <Text className="text-xl">{colorScheme === "dark" ? "☀️" : "🌙"}</Text>
          </TouchableOpacity>
        </View>

        {/* Department Selector */}
        <View className="mb-4">
          <TouchableOpacity
            onPress={() => setShowDeptDropdown(!showDeptDropdown)}
            activeOpacity={0.7}
            className="bg-surface rounded-xl border border-border px-4 py-3 flex-row items-center justify-between"
          >
            <View className="flex-row items-center">
              <Text className="text-muted mr-2">🏛️</Text>
              <Text className="text-base font-semibold text-foreground">
                {departments.find((d) => d.code === department)?.name || "CSE"}
              </Text>
            </View>
            <Text className="text-muted">{showDeptDropdown ? "▲" : "▼"}</Text>
          </TouchableOpacity>

          {showDeptDropdown && (
            <View className="mt-2 bg-surface rounded-xl border border-border overflow-hidden">
              {departments.map((dept) => (
                <TouchableOpacity
                  key={dept.code}
                  onPress={() => {
                    setDepartment(dept.code);
                    setShowDeptDropdown(false);
                    if (Platform.OS !== "web") {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }
                  }}
                  activeOpacity={0.7}
                  className={`px-4 py-3 border-b border-border ${dept.code === department ? "bg-primary/10" : ""}`}
                >
                  <Text className={`text-base ${dept.code === department ? "font-semibold text-primary" : "text-foreground"}`}>
                    {dept.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Search */}
        <View className="mb-6">
          <View className="flex-row items-center gap-2 mb-2">
            <View className="flex-1 bg-surface rounded-xl border border-border px-4 py-3 flex-row items-center">
              <Text className="text-muted mr-2">🔍</Text>
              <TextInput
                className="flex-1 text-base text-foreground"
                placeholder="Enter batch_section (e.g., 71_I)"
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setShowSuggestions(text.length > 0);
                }}
                onFocus={() => setShowSuggestions(searchQuery.length > 0)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
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
            <TouchableOpacity
              onPress={async () => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                setIsRefreshing(true);
                try {
                  await clearCacheMutation.mutateAsync({ department });
                  // Refetch data
                  await refetch();
                } catch (error) {
                  console.error("Failed to clear cache:", error);
                } finally {
                  setIsRefreshing(false);
                }
              }}
              activeOpacity={0.7}
              className="bg-surface rounded-xl px-4 py-3 border border-border"
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text className="text-lg">🔄</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Autocomplete Suggestions */}
          {showSuggestions && batchSectionsData && batchSectionsData.batchSections.length > 0 && (
            <View className="bg-surface rounded-xl border border-border p-2 max-h-48">
              <ScrollView>
                {batchSectionsData.batchSections
                  .filter((bs) => bs.toLowerCase().includes(searchQuery.toLowerCase()))
                  .slice(0, 10)
                  .map((bs) => (
                    <TouchableOpacity
                      key={bs}
                      onPress={() => {
                        setSearchQuery(bs);
                        setShowSuggestions(false);
                        if (Platform.OS !== "web") {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                      }}
                      activeOpacity={0.7}
                      className="py-2 px-3 border-b border-border"
                    >
                      <Text className="text-base text-foreground">{bs}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Results */}
        {error ? (
          <ErrorMessage
            title="PDF Parsing Failed"
            message={error.message || "Unable to parse the routine PDF. The file may be corrupted or in an unsupported format."}
            suggestion="Check your internet connection and try again. If the problem persists, the PDF format may have changed."
          />
        ) : isLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="text-base font-semibold text-foreground mt-4">Loading Schedule...</Text>
            <Text className="text-sm text-muted mt-2 text-center px-6">
              {scheduleData ? "Almost there..." : "Parsing PDF and extracting classes"}
            </Text>
            <View className="mt-4 bg-primary/10 rounded-lg px-4 py-2">
              <Text className="text-xs text-primary text-center">
                ✨ First load may take 5-10 seconds, then instant!
              </Text>
            </View>
          </View>
        ) : searchQuery.length >= 3 && schedules.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No Classes Found"
            message={`No classes found for batch_section "${searchQuery}". Please check the format (e.g., 71_I, 69_A) and try again.`}
          />
        ) : schedules.length > 0 ? (
          <>
            {/* Faculty Photos */}
            {renderFacultyPhotos()}

            {/* Last Updated Timestamp */}
            {scheduleData?.parsedAt && (
              <View className="mb-4 items-center">
                <Text className="text-xs text-muted">
                  {formatTimestamp(scheduleData.parsedAt)}
                </Text>
              </View>
            )}

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
              Try a different batch_section combination
            </Text>
          </View>
        ) : (
          <View className="bg-surface rounded-2xl p-6 items-center border border-border">
            <Text className="text-4xl mb-2">👋</Text>
            <Text className="text-base text-foreground font-medium">
              Welcome!
            </Text>
            <Text className="text-sm text-muted mt-1 text-center">
              Enter your batch and section to view your schedule
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Teacher Details Modal */}
      <Modal
        visible={showTeacherModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowTeacherModal(false)}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center px-6"
          onPress={() => setShowTeacherModal(false)}
        >
          <Pressable
            className="bg-surface rounded-2xl p-6 w-full max-w-md border border-border"
            onPress={(e) => e.stopPropagation()}
          >
            {selectedTeacher && (
              <View>
                {/* Header */}
                <View className="flex-row items-center mb-4">
                  <View className="bg-primary rounded-full w-12 h-12 items-center justify-center mr-3">
                    <Text className="text-xl font-bold text-white">
                      {selectedTeacher.initials}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-foreground">
                      {selectedTeacher.name}
                    </Text>
                    <Text className="text-sm text-muted mt-1">
                      {selectedTeacher.designation}
                    </Text>
                  </View>
                </View>

                {/* Contact Info */}
                <View className="space-y-3">
                  {/* Email */}
                  {selectedTeacher.email && (
                    <View className="bg-background rounded-xl p-3 border border-border">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-2">
                          <Text className="text-xs text-muted mb-1">📧 Email</Text>
                          <Text className="text-sm text-foreground" numberOfLines={1}>
                            {selectedTeacher.email}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => copyToClipboard(selectedTeacher.email!, 'Email')}
                          className="bg-surface rounded-lg p-2 border border-border"
                        >
                          <Text className="text-lg">📋</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Phone */}
                  {selectedTeacher.phone && (
                    <View className="bg-background rounded-xl p-3 border border-border">
                      <View className="flex-row items-center justify-between">
                        <View className="flex-1 mr-2">
                          <Text className="text-xs text-muted mb-1">📞 Phone</Text>
                          <Text className="text-sm text-foreground">
                            {selectedTeacher.phone}
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => copyToClipboard(selectedTeacher.phone!, 'Phone')}
                          className="bg-surface rounded-lg p-2 border border-border"
                        >
                          <Text className="text-lg">📋</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Office Room */}
                  {selectedTeacher.room && (
                    <View className="bg-background rounded-xl p-3 border border-border">
                      <Text className="text-xs text-muted mb-1">📍 Office Room</Text>
                      <Text className="text-sm text-foreground">
                        {selectedTeacher.room}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Close Button */}
                <TouchableOpacity
                  onPress={() => setShowTeacherModal(false)}
                  className="bg-primary rounded-xl py-3 mt-4"
                  activeOpacity={0.8}
                >
                  <Text className="text-center text-white font-semibold">Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DropdownSelect from "react-native-input-select";

const SERVER_URL = process.env.EXPO_PUBLIC_API_URL;
const LOGIN_ENDPOINT = `${SERVER_URL}/auth/sign_in`;
const AUTH_TOKEN_KEY = "kkb-auth-token";

type InstructionHistoryItem = {
  id: number | string;
  day?: string | null;
  toUserName?: string | null;
  categoryName?: string | null;
  comment?: string | null;
  fileUrl?: string | null;
};

export default function Index() {
  const [toUserId, setToUserId] = useState<number>();
  const [userOptions, setUserOptions] = useState<
    {
      id: number;
      name: string;
    }[]
  >([]);
  const [categoryId, setCategoryId] = useState<number>();
  const [categoryOptions, setCategoryOptions] = useState<
    {
      id: number;
      name: string;
    }[]
  >([]);
  const [textPayload, setTextPayload] = useState("");
  const [videoAsset, setVideoAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [userCode, setUserCode] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggedInUser, setLoggedInUser] = useState<{
    userId: number;
    name: string;
  } | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [instructionHistory, setInstructionHistory] = useState<
    InstructionHistoryItem[]
  >([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuthState = async () => {
      try {
        const storedAuthToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
        if (storedAuthToken) {
          setAuthToken(storedAuthToken);
          const authInfoObj = JSON.parse(storedAuthToken);
          const detectedUserId = authInfoObj["userId"];
          const detectedUserName = authInfoObj["name"];
          // if (detectedUserId && detectedUserName) {
          //   setLoggedInUser({
          //     userId: detectedUserId,
          //     name: detectedUserName,
          //   });
          // }
          const response = await fetch(`${SERVER_URL}/auth/validate_token`, {
            method: "GET",
            headers: {
              "access-token": authInfoObj["accessToken"],
              client: authInfoObj["client"],
              uid: authInfoObj["uid"],
            },
          });

          if (!response.ok) {
            throw new Error(`HTTP status ${response.status}`);
          }

          const authData = await response.json();
          if (authData.status) {
            const detectedUserId = authInfoObj["userId"];
            const detectedUserName = authInfoObj["name"];
            if (detectedUserId && detectedUserName) {
              setLoggedInUser({
                userId: detectedUserId,
                name: detectedUserName,
              });
            }
          }
        }
      } catch (error) {
        setStatusMessage(
          `保存した認証情報の読み込みに失敗しました: ${
            error instanceof Error ? error.message : "原因不明のエラー"
          }`
        );
      } finally {
        setIsAuthenticating(false);
      }
    };

    initializeAuthState();
  }, []);

  useEffect(() => {
    loadUserOptions();
    loadCategoryOptions();
  }, [authToken, loggedInUser]);

  useEffect(() => {
    if (!authToken) {
      setInstructionHistory([]);
      setHistoryError(null);
    }
  }, [authToken]);

  const loadInstructionHistory = useCallback(async () => {
    if (!authToken) {
      return;
    }

    const authInfoObj = JSON.parse(authToken);
    setIsHistoryLoading(true);
    setHistoryError(null);

    const queryParams = new URLSearchParams({
      userId: String(loggedInUser?.userId),
    });

    try {
      console.log(`${SERVER_URL}/shift_managements?${queryParams}`);
      const response = await fetch(
        `${SERVER_URL}/shift_managements?${queryParams}`,
        {
          method: "GET",
          headers: {
            "access-token": authInfoObj["accessToken"],
            client: authInfoObj["client"],
            uid: authInfoObj["uid"],
            expiry: authInfoObj["expiry"],
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }

      const responseBody = await response.json();
      const rawItems = Array.isArray(responseBody)
        ? responseBody
        : Array.isArray(responseBody?.data)
        ? responseBody.data
        : [];

      const normalizedItems: InstructionHistoryItem[] = rawItems.map(
        (item: any, index: number) => {
          const toUserIdentifier = item.toUserId ?? item.to_user_id ?? null;
          const numericToUserId =
            typeof toUserIdentifier === "number"
              ? toUserIdentifier
              : toUserIdentifier
              ? Number(toUserIdentifier)
              : null;

          return {
            id:
              item.id ??
              `${item.created_at ?? item.createdAt ?? "history"}-${index}`,
            toUserId: Number.isNaN(numericToUserId) ? null : numericToUserId,
            toUserName:
              item.toUserName ??
              item.to_user_name ??
              item.to_user ??
              item.toUser ??
              null,
            categoryName:
              item.categoryName ??
              item.category_name ??
              item.shift_category_name ??
              item.shiftCategory?.name ??
              null,
            comment: item.comment ?? item.body ?? "",
            day: item.day ?? item.created_at ?? item.created_on ?? null,
            fileUrl:
              item.fileUrl ??
              item.file_url ??
              item.video_url ??
              item.file ??
              null,
          };
        }
      );

      setInstructionHistory(normalizedItems);
    } catch (error) {
      setHistoryError(
        `履歴の取得に失敗しました: ${
          error instanceof Error ? error.message : "原因不明のエラー"
        }`
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (activeTab === "history" && authToken) {
      loadInstructionHistory();
    }
  }, [activeTab, authToken, loadInstructionHistory]);

  const loadUserOptions = async () => {
    if (!authToken) {
      return;
    }

    const authInfoObj = JSON.parse(authToken);

    try {
      const response = await fetch(`${SERVER_URL}/users`, {
        method: "GET",
        headers: {
          "access-token": authInfoObj["accessToken"],
          client: authInfoObj["client"],
          uid: authInfoObj["uid"],
          expiry: authInfoObj["expiry"],
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }

      const options: {
        id: number;
        name: string;
      }[] = [];
      const userData = await response.json();
      if (userData) {
        userData.forEach((data: any) => {
          options.push({ id: data.id, name: `${data.name}（${data.code}）` });
        });
        setUserOptions(options);
      }
    } catch (error) {
      setStatusMessage(
        `宛先の取得に失敗しました: ${
          error instanceof Error ? error.message : "原因不明のエラー"
        }`
      );
    }
  };

  const loadCategoryOptions = async () => {
    if (!authToken) {
      return;
    }

    const authInfoObj = JSON.parse(authToken);

    try {
      const response = await fetch(`${SERVER_URL}/shift_categories`, {
        method: "GET",
        headers: {
          "access-token": authInfoObj["accessToken"],
          client: authInfoObj["client"],
          uid: authInfoObj["uid"],
          expiry: authInfoObj["expiry"],
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }

      const options: {
        id: number;
        name: string;
      }[] = [];
      const categoryData = await response.json();
      if (categoryData) {
        categoryData.forEach((data: any) => {
          options.push({ id: data.id, name: data.name });
        });
        setCategoryOptions(options);
      }
    } catch (error) {
      setStatusMessage(
        `カテゴリーの取得に失敗しました: ${
          error instanceof Error ? error.message : "原因不明のエラー"
        }`
      );
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      Alert.alert(
        "カメラの権限がありません",
        "設定アプリでカメラの権限を有効にしてください。"
      );
      return false;
    }
    return true;
  };

  const handleRecordVideo = async () => {
    setStatusMessage(null);

    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "videos",
      cameraType: ImagePicker.CameraType.front,
      allowsEditing: false,
      quality: 0,
      videoMaxDuration: 180,
    });

    if (result.canceled) {
      return;
    }

    setVideoAsset(result.assets[0]);
  };

  const handleResetVideo = () => {
    setVideoAsset(null);
  };

  const handleLogin = async () => {
    if (!userCode.trim() || !loginPassword.trim()) {
      setStatusMessage("IDとパスワードを入力してください。");
      return;
    }

    setIsLoggingIn(true);
    setStatusMessage("ログインしています…");

    try {
      const response = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          code: userCode.trim(),
          password: loginPassword,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }

      const accessToken = response.headers.get("access-token");
      const client = response.headers.get("client");
      const uid = response.headers.get("uid");
      const expiry = response.headers.get("expiry");
      const authTokenObj = { accessToken, client, uid, expiry };
      const responseBody = await response.json();

      if (!responseBody || !responseBody.data) {
        throw new Error(`No User Data`);
      }

      const data = responseBody.data;
      const userObj = {
        userId: data.id,
        name: `${data.name1} ${data.name2}（${data.code}）`,
      };
      setLoggedInUser(userObj);

      const authTokenString = JSON.stringify({
        ...authTokenObj,
        ...userObj,
      });

      await SecureStore.setItemAsync(AUTH_TOKEN_KEY, authTokenString);
      setAuthToken(authTokenString);

      setStatusMessage("ログインに成功しました。");
      setLoginPassword("");
    } catch (error) {
      setStatusMessage(
        `ログインに失敗しました: ${
          error instanceof Error ? error.message : "原因不明のエラー"
        }`
      );
      setLoggedInUser(null);
      setAuthToken(null);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    } catch (error) {
      setStatusMessage(
        `ログアウト処理中にエラーが発生しました: ${
          error instanceof Error ? error.message : "原因不明のエラー"
        }`
      );
    } finally {
      setAuthToken(null);
      setLoggedInUser(null);
      setStatusMessage("ログアウトしました。");
    }
  };

  const uploadInstruction = async () => {
    if (!toUserId) {
      setStatusMessage("宛先を選択してください。");
      return;
    }

    if (!textPayload.trim() && !videoAsset) {
      setStatusMessage("指示内容を入力するか、動画を指定してください。");
      return;
    }

    if (!authToken) {
      setStatusMessage("先にログインしてください。");
      return;
    }

    const authTokenObj = JSON.parse(authToken);

    setIsUploading(true);
    setStatusMessage("送信しています…");

    try {
      const formData = new FormData();
      formData.append("userId", String(loggedInUser?.userId));
      formData.append("toUserId", String(toUserId));
      if (categoryId) {
        formData.append("shiftCategoryId", String(categoryId));
      }
      if (textPayload.trim()) {
        formData.append("text", textPayload.trim());
      }

      if (videoAsset) {
        const fileName =
          videoAsset.fileName ??
          `video-${Date.now()}.${
            videoAsset.mimeType?.split("/").pop() ?? "mp4"
          }`;

        formData.append("file", {
          uri: videoAsset.uri,
          name: fileName,
          type: videoAsset.mimeType ?? "video/mp4",
        } as never);
      }

      const response = await fetch(`${SERVER_URL}/shift_managements/`, {
        method: "POST",
        headers: {
          "access-token": authTokenObj["accessToken"],
          client: authTokenObj["client"],
          uid: authTokenObj["uid"],
          expiry: authTokenObj["expiry"],
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP status ${response.status}`);
      }

      setStatusMessage("送信に成功しました。");
      setToUserId(undefined);
      setCategoryId(undefined);
      setTextPayload("");
      setVideoAsset(null);
    } catch (error) {
      setStatusMessage(
        `送信に失敗しました: ${
          error instanceof Error ? error.message : "原因不明のエラー"
        }`
      );
    } finally {
      setIsUploading(false);
    }
  };

  const formatTimestamp = (timestamp?: string | null) => {
    if (!timestamp) {
      return "日時不明";
    }

    const parsedDate = new Date(timestamp);
    if (Number.isNaN(parsedDate.getTime())) {
      return timestamp;
    }

    return parsedDate.toLocaleDateString("ja-JP");
  };

  if (isAuthenticating) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>初期化しています…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="never"
      >
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "form" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("form")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "form" && styles.tabButtonTextActive,
              ]}
            >
              指示入力
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "history" && styles.tabButtonActive,
            ]}
            onPress={() => setActiveTab("history")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "history" && styles.tabButtonTextActive,
              ]}
            >
              送信履歴
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "form" ? (
          authToken ? (
            <>
              <View style={styles.logoutContainer}>
                <Text style={styles.sessionText}>
                  {loggedInUser
                    ? `ログイン中: ${loggedInUser.name}`
                    : "ログイン済み"}
                </Text>
                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleLogout}
                  disabled={isUploading}
                >
                  <Text style={styles.logoutButtonText}>ログアウト</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.section}>
                <DropdownSelect
                  label="宛先"
                  placeholder="選択してください"
                  options={userOptions}
                  optionLabel={"name"}
                  optionValue={"id"}
                  selectedValue={toUserId}
                  onValueChange={(itemValue: any) => setToUserId(itemValue)}
                  isSearchable
                  primaryColor={"#1e40af"}
                  selectedItemsControls={{
                    showRemoveIcon: true,
                  }}
                />
                <DropdownSelect
                  label="カテゴリー"
                  placeholder="選択してください"
                  options={categoryOptions}
                  optionLabel={"name"}
                  optionValue={"id"}
                  selectedValue={categoryId}
                  onValueChange={(itemValue: any) => setCategoryId(itemValue)}
                  isSearchable
                  primaryColor={"#1e40af"}
                  selectedItemsControls={{
                    showRemoveIcon: true,
                  }}
                />
                <TextInput
                  style={styles.multilineInput}
                  placeholder="指示内容を入力"
                  placeholderTextColor="#7d7d7d"
                  multiline
                  value={textPayload}
                  onChangeText={setTextPayload}
                  editable={!isUploading}
                />

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleRecordVideo}
                  disabled={isUploading}
                >
                  <Text style={styles.secondaryButtonText}>動画を撮影する</Text>
                </TouchableOpacity>

                {videoAsset ? (
                  <View style={styles.videoPreview}>
                    <Text style={styles.label}>選択された動画</Text>
                    <Text style={styles.videoInfo} numberOfLines={1}>
                      {videoAsset.fileName ?? videoAsset.uri}
                    </Text>
                    <TouchableOpacity
                      style={styles.videoActionButton}
                      onPress={handleResetVideo}
                      disabled={isUploading}
                    >
                      <Text style={styles.secondaryButtonText}>
                        動画を削除する
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.helperText}>
                    まだ動画は選択されていません。
                  </Text>
                )}
              </View>

              <View style={styles.section}>
                <TouchableOpacity
                  style={[styles.button, isUploading && styles.buttonDisabled]}
                  disabled={isUploading}
                  onPress={uploadInstruction}
                >
                  <Text style={styles.buttonText}>送信</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ログイン</Text>
              <TextInput
                style={styles.loginInput}
                placeholder="ユーザーID"
                placeholderTextColor="#7d7d7d"
                autoCapitalize="none"
                value={userCode}
                onChangeText={setUserCode}
                editable={!isLoggingIn}
              />
              <TextInput
                style={styles.loginInput}
                placeholder="パスワード"
                placeholderTextColor="#7d7d7d"
                secureTextEntry
                value={loginPassword}
                onChangeText={setLoginPassword}
                editable={!isLoggingIn}
              />
              <TouchableOpacity
                style={[
                  styles.button,
                  (isLoggingIn || isUploading) && styles.buttonDisabled,
                ]}
                disabled={isLoggingIn || isUploading}
                onPress={handleLogin}
              >
                <Text style={styles.buttonText}>ログイン</Text>
              </TouchableOpacity>
            </View>
          )
        ) : (
          <View style={styles.section}>
            {authToken ? (
              <>
                <View style={styles.historyHeader}>
                  <Text style={styles.sectionTitle}>送信履歴</Text>
                  <TouchableOpacity
                    style={[
                      styles.historyRefreshButton,
                      isHistoryLoading && styles.buttonDisabled,
                    ]}
                    onPress={loadInstructionHistory}
                    disabled={isHistoryLoading}
                  >
                    <Text
                      style={[
                        styles.historyRefreshText,
                        isHistoryLoading && styles.buttonDisabled,
                      ]}
                    >
                      {isHistoryLoading ? "更新中…" : "再読み込み"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isHistoryLoading ? (
                  <View style={styles.loaderContainer}>
                    <ActivityIndicator size="small" color="#1e40af" />
                  </View>
                ) : historyError ? (
                  <Text style={styles.errorText}>{historyError}</Text>
                ) : instructionHistory.length === 0 ? (
                  <Text style={styles.helperText}>
                    まだ送信履歴がありません。
                  </Text>
                ) : (
                  instructionHistory.map((item) => (
                    <View key={String(item.id)} style={styles.historyCard}>
                      <Text style={styles.historyTitle}>{item.toUserName}</Text>
                      <Text style={styles.historyMeta}>
                        {formatTimestamp(item.day)}
                        {item.categoryName ? ` ・ ${item.categoryName}` : ""}
                      </Text>
                      {item.comment ? (
                        <Text style={styles.historyText}>{item.comment}</Text>
                      ) : (
                        <Text style={styles.historyPlaceholder}>
                          テキスト入力なし
                        </Text>
                      )}
                      {item.fileUrl ? (
                        <Text style={styles.historyAttachment}>
                          動画添付あり
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}
              </>
            ) : (
              <Text style={styles.helperText}>
                履歴を確認するにはログインしてください。
              </Text>
            )}
          </View>
        )}

        {(isUploading || isLoggingIn) && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color="#1e40af" />
          </View>
        )}

        {statusMessage ? (
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f5f7",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f5f7",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: "#1e3a8a",
    fontSize: 16,
  },
  content: {
    flexGrow: 1,
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 24,
    textAlign: "center",
  },
  section: {
    marginBottom: 32,
    padding: 20,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  loginInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#f9fafb",
    marginBottom: 12,
  },
  multilineInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#f9fafb",
    marginBottom: 12,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#1e40af",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#1e40af",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  secondaryButtonText: {
    color: "#1e40af",
    fontSize: 16,
    fontWeight: "600",
  },
  helperText: {
    marginTop: 12,
    color: "#6b7280",
  },
  sessionText: {
    color: "#1f2937",
    fontSize: 14,
  },
  logoutContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  logoutButtonText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 4,
  },
  videoInfo: {
    fontSize: 14,
    color: "#111827",
    marginBottom: 12,
  },
  videoPreview: {
    marginTop: 16,
    padding: 16,
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  videoActions: {
    flexDirection: "column",
  },
  videoActionButton: {
    width: "100%",
    marginBottom: 12,
  },
  loaderContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  statusContainer: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#e0e7ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  statusText: {
    color: "#1e3a8a",
    fontSize: 14,
    textAlign: "center",
  },
  tabBar: {
    flexDirection: "row",
    marginBottom: 24,
    backgroundColor: "#e0e7ff",
    borderRadius: 999,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  tabButtonText: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "600",
  },
  tabButtonTextActive: {
    color: "#1e40af",
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  historyRefreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1e40af",
  },
  historyRefreshText: {
    color: "#1e40af",
    fontSize: 14,
    fontWeight: "600",
  },
  historyCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  historyMeta: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
  },
  historyText: {
    fontSize: 14,
    color: "#1f2937",
    marginBottom: 8,
  },
  historyPlaceholder: {
    fontSize: 14,
    color: "#9ca3af",
    marginBottom: 8,
  },
  historyAttachment: {
    fontSize: 13,
    color: "#1e40af",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
  },
});

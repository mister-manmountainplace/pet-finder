import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const REPORTS_KEY = 'pet-finder.reports';

function helperUrl() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.manifest?.hostUri;
  const host = hostUri?.replace(/^[a-z]+:\/\//, '').split(':')[0];
  return host ? `http://${host}:8787` : null;
}

function imagePayload(image) {
  if (!image?.base64) return null;
  return { base64: image.base64, mimeType: image.mimeType || 'image/jpeg' };
}

export default function App() {
  const [missingPoster, setMissingPoster] = useState(null);
  const [foundAnimal, setFoundAnimal] = useState(null);
  const [evidenceImage, setEvidenceImage] = useState(null);
  const [location, setLocation] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [thinking, setThinking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const networkHelperUrl = useMemo(helperUrl, []);

  useEffect(() => {
    AsyncStorage.getItem(REPORTS_KEY).then((value) => {
      if (!value) return;
      try { setReportCount(JSON.parse(value).length); } catch { setReportCount(0); }
    });
  }, []);

  async function chooseImage(setImage) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission needed', 'Allow photo access so Pet Finder can compare an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled) setImage(result.assets[0]);
  }

  async function askHelper(prompt, images) {
    setError('');
    setAnswer('');
    if (!networkHelperUrl) {
      setError('Pet Finder cannot find the computer helper. Start Expo on the same Wi-Fi as this phone.');
      return;
    }
    setThinking(true);
    try {
      const response = await fetch(`${networkHelperUrl}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          location,
          images: images.map(imagePayload).filter(Boolean),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.error) {
        throw new Error(body.error?.message || 'Pet Finder could not get an AI answer. Check the Wi-Fi and helper.');
      }
      setAnswer(body.answer || 'The AI did not return an answer.');
    } catch (requestError) {
      setError(requestError.message || 'Check the Wi-Fi and the Pet Finder helper.');
    } finally {
      setThinking(false);
    }
  }

  function comparePets() {
    if (!missingPoster || !foundAnimal) {
      Alert.alert('Add two photos', 'Choose a missing-pet poster and a found-animal photo first.');
      return;
    }
    const extraQuestion = question.trim() ? ` The user also asks: ${question.trim()}` : '';
    askHelper(
      `Compare the missing-pet poster with the found-animal photo. List possible matches from most likely to least likely. Explain the visible evidence briefly. Never call anything a 100 percent match. Do not request personal information.${extraQuestion}`,
      [missingPoster, foundAnimal],
    );
  }

  function verifyEvidence() {
    if (!evidenceImage) {
      Alert.alert('Add evidence', 'Choose a photo of the found animal or its evidence first.');
      return;
    }
    askHelper(
      'Review this found-pet evidence. Say what visible details support or weaken it. Never say it is a 100 percent match, and never ask for personal information.',
      [evidenceImage],
    );
  }

  async function saveReport() {
    if (!reportDetails.trim() || !location.trim()) {
      Alert.alert('Add report details', 'Include the location and a short description before saving.');
      return;
    }
    const previous = JSON.parse((await AsyncStorage.getItem(REPORTS_KEY)) || '[]');
    const next = [...previous, {
      id: Date.now().toString(),
      details: reportDetails.trim(),
      location: location.trim(),
      imageUri: foundAnimal?.uri || evidenceImage?.uri || null,
    }];
    await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(next));
    setReportCount(next.length);
    setSaved(true);
    setReportDetails('');
  }

  async function sharePoster() {
    if (missingPoster?.uri && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(missingPoster.uri);
      return;
    }
    await Share.share({ message: `Pet Finder missing pet poster. Last seen near ${location || 'an unknown location'}.` });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.kicker}>COMMUNITY PET MATCHING</Text>
          <Text style={styles.title}>Pet Finder</Text>
          <Text style={styles.subtitle}>Compare a missing poster with a found animal photo, then act safely.</Text>
        </View>

        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Safety first</Text>
          <Text style={styles.warningText}>Never send money or share your home address. Ask for evidence, meet in a public place, and contact a trusted adult or shelter.</Text>
        </View>

        <Section number="1" title="Compare photos" caption="This is the main Pet Finder difference: image evidence first, not just a poster feed.">
          <PhotoButton label="Choose missing-pet poster" image={missingPoster} onPress={() => chooseImage(setMissingPoster)} />
          <PhotoButton label="Choose found-animal photo" image={foundAnimal} onPress={() => chooseImage(setFoundAnimal)} />
          <TextInput value={location} onChangeText={setLocation} placeholder="Location (city or safe landmark)" placeholderTextColor="#8190a5" style={styles.input} />
          <TextInput value={question} onChangeText={setQuestion} placeholder="Optional question for the AI" placeholderTextColor="#8190a5" style={[styles.input, styles.multiline]} multiline />
          <PrimaryButton label={thinking ? 'Thinking…' : 'Compare & ask AI'} onPress={comparePets} disabled={thinking} />
          {thinking && <ActivityIndicator color="#7c5cff" style={styles.loader} />}
          {answer ? <AnswerCard answer={answer} /> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Section>

        <Section number="2" title="Submit evidence" caption="Give the AI a focused evidence check before contacting anyone.">
          <PhotoButton label="Choose evidence photo" image={evidenceImage} onPress={() => chooseImage(setEvidenceImage)} />
          <SecondaryButton label="Verify evidence with AI" onPress={verifyEvidence} disabled={thinking} />
        </Section>

        <Section number="3" title="Report a found pet" caption="Reports are saved on this phone for now.">
          <TextInput value={reportDetails} onChangeText={setReportDetails} placeholder="Describe the animal and visible evidence" placeholderTextColor="#8190a5" style={[styles.input, styles.multiline]} multiline />
          <PrimaryButton label="Save found-pet report" onPress={saveReport} />
          {saved ? <Text style={styles.success}>Saved on this phone. Reports saved: {reportCount}.</Text> : null}
        </Section>

        <Section number="4" title="Scam warnings" caption="A real match still needs safe human verification.">
          <Text style={styles.bullet}>• Do not pay a fee to receive your pet.</Text>
          <Text style={styles.bullet}>• Do not share passwords, codes, or your home address.</Text>
          <Text style={styles.bullet}>• Ask for a fresh photo or another safe proof of the animal.</Text>
          <Text style={styles.bullet}>• Bring a trusted adult and meet in a public place.</Text>
        </Section>

        <Section number="5" title="Share your poster" caption="Share the selected poster so more people notice it.">
          <SecondaryButton label="Share missing-pet poster" onPress={sharePoster} disabled={!missingPoster} />
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>AI answers are suggestions, not proof. Check evidence safely.</Text>
          <Text style={styles.footerText}>Helper: {networkHelperUrl || 'not detected'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ number, title, caption, children }) {
  return <View style={styles.section}>
    <View style={styles.sectionHeading}>
      <View style={styles.number}><Text style={styles.numberText}>{number}</Text></View>
      <View style={styles.headingCopy}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.caption}>{caption}</Text></View>
    </View>
    {children}
  </View>;
}

function PhotoButton({ label, image, onPress }) {
  return <Pressable style={styles.photoButton} onPress={onPress}>
    {image ? <Image source={{ uri: image.uri }} style={styles.thumb} /> : <View style={styles.photoPlaceholder}><Text style={styles.plus}>+</Text></View>}
    <Text style={styles.photoLabel}>{image ? 'Change photo' : label}</Text>
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
}

function PrimaryButton({ label, onPress, disabled }) {
  return <Pressable style={[styles.primary, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={styles.primaryText}>{label}</Text></Pressable>;
}

function SecondaryButton({ label, onPress, disabled }) {
  return <Pressable style={[styles.secondary, disabled && styles.disabled]} onPress={onPress} disabled={disabled}><Text style={styles.secondaryText}>{label}</Text></Pressable>;
}

function AnswerCard({ answer }) {
  return <View style={styles.answer}><Text style={styles.answerTitle}>Possible matches</Text><Text style={styles.answerText}>{answer}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' }, content: { paddingBottom: 32 },
  hero: { backgroundColor: '#18243d', paddingHorizontal: 22, paddingTop: 36, paddingBottom: 28 },
  kicker: { color: '#aab8ff', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, title: { color: '#fff', fontSize: 38, fontWeight: '900', marginTop: 6 },
  subtitle: { color: '#dbe2f2', fontSize: 16, lineHeight: 23, marginTop: 8, maxWidth: 340 },
  warning: { backgroundColor: '#fff3d7', margin: 16, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#f4d28a' }, warningTitle: { color: '#76510b', fontSize: 16, fontWeight: '800', marginBottom: 5 }, warningText: { color: '#76510b', lineHeight: 20 },
  section: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 14, padding: 16, borderRadius: 20, shadowColor: '#18243d', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }, sectionHeading: { flexDirection: 'row', marginBottom: 14 },
  number: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ece8ff', alignItems: 'center', justifyContent: 'center', marginRight: 10 }, numberText: { color: '#6048d8', fontWeight: '900' }, headingCopy: { flex: 1 }, sectionTitle: { color: '#18243d', fontSize: 21, fontWeight: '800' }, caption: { color: '#647189', fontSize: 13, lineHeight: 18, marginTop: 3 },
  photoButton: { borderWidth: 1, borderColor: '#dbe1ed', borderRadius: 14, minHeight: 68, padding: 10, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, photoPlaceholder: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#f0edff', alignItems: 'center', justifyContent: 'center' }, plus: { fontSize: 28, color: '#6c54df', fontWeight: '300' }, thumb: { width: 46, height: 46, borderRadius: 10 }, photoLabel: { flex: 1, color: '#26344f', fontWeight: '700', marginLeft: 12 }, chevron: { color: '#6c54df', fontSize: 28, fontWeight: '300' },
  input: { borderWidth: 1, borderColor: '#dbe1ed', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, color: '#18243d', marginBottom: 10, backgroundColor: '#fbfcff' }, multiline: { minHeight: 48, textAlignVertical: 'top' },
  primary: { backgroundColor: '#6c54df', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 2 }, primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' }, secondary: { borderWidth: 1, borderColor: '#6c54df', paddingVertical: 13, borderRadius: 12, alignItems: 'center', marginTop: 2 }, secondaryText: { color: '#6048d8', fontSize: 15, fontWeight: '800' }, disabled: { opacity: 0.45 }, loader: { marginTop: 12 },
  answer: { backgroundColor: '#eef9f4', borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1, borderColor: '#bde7d1' }, answerTitle: { color: '#176746', fontWeight: '900', marginBottom: 5 }, answerText: { color: '#214333', lineHeight: 21 }, error: { color: '#b42318', backgroundColor: '#fff0ef', padding: 12, borderRadius: 10, marginTop: 12, lineHeight: 19 }, success: { color: '#176746', backgroundColor: '#eef9f4', padding: 12, borderRadius: 10, marginTop: 10 }, bullet: { color: '#34415a', lineHeight: 24 }, footer: { paddingHorizontal: 22, paddingTop: 6 }, footerText: { color: '#7a879d', fontSize: 12, marginBottom: 5 },
});

import 'dart:convert';
import 'package:http/http.dart' as http;

void main() async {
  final query1 = Uri.encodeQueryComponent("Lonely Boy Andrew Gold");
  final url1 = Uri.parse('https://itunes.apple.com/search?term=$query1&entity=song&limit=1');
  
  final query2 = Uri.encodeQueryComponent("Andrew Gold Lonely Boy");
  final url2 = Uri.parse('https://itunes.apple.com/search?term=$query2&entity=song&limit=1');
  
  try {
    final response1 = await http.get(url1);
    final json1 = jsonDecode(response1.body);
    print('Query1 Results: ${json1['resultCount']}');

    final response2 = await http.get(url2);
    final json2 = jsonDecode(response2.body);
    print('Query2 Results: ${json2['resultCount']}');
  } catch (e) {
    print('Error: $e');
  }
}

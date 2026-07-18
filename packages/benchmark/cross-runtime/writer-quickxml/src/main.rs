use quick_xml::events::{BytesDecl, BytesEnd, BytesStart, BytesText, Event};
use quick_xml::Writer;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::time::Instant;

const DESCRIPTION: &str = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.";

fn element<W: Write>(writer: &mut Writer<W>, name: &str, value: &str) {
    writer.write_event(Event::Start(BytesStart::new(name))).unwrap();
    writer.write_event(Event::Text(BytesText::new(value))).unwrap();
    writer.write_event(Event::End(BytesEnd::new(name))).unwrap();
}

fn main() {
    let records: usize = std::env::args().nth(1).unwrap().parse().unwrap();
    let output_path = std::env::args().nth(2).unwrap();
    let output = File::create(&output_path).unwrap();
    let mut writer = Writer::new(BufWriter::new(output));
    let started = Instant::now();
    writer.write_event(Event::Decl(BytesDecl::new("1.0", Some("UTF-8"), None))).unwrap();
    writer.write_event(Event::Start(BytesStart::new("books"))).unwrap();
    for book_id in 1..=records {
        let id = format!("book-{book_id}");
        let mut book = BytesStart::new("book");
        book.push_attribute(("id", id.as_str()));
        writer.write_event(Event::Start(book)).unwrap();
        element(&mut writer, "title", &format!("Sample Book Title Number {book_id} - Lorem ipsum dolor sit amet, consectetur adipiscing elit"));
        element(&mut writer, "author", &format!("Author Name {book_id}"));
        element(&mut writer, "isbn", &format!("978{}", 100000000 + ((book_id * 48271) % 900000000)));
        element(&mut writer, "publisher", &format!("Sample Publisher {book_id}"));
        element(&mut writer, "publishDate", &format!("{}-{:02}-{:02}", 2020 + book_id % 5, book_id % 12 + 1, book_id % 28 + 1));
        element(&mut writer, "description", DESCRIPTION);
        writer.write_event(Event::Start(BytesStart::new("chapters"))).unwrap();
        for (index, name) in ["Introduction", "Main Content", "Conclusion"].iter().enumerate() {
            let mut chapter = BytesStart::new("chapter");
            let number = (index + 1).to_string();
            chapter.push_attribute(("number", number.as_str()));
            writer.write_event(Event::Start(chapter)).unwrap();
            writer.write_event(Event::Text(BytesText::new(&format!("{name} Chapter for Book {book_id}")))).unwrap();
            writer.write_event(Event::End(BytesEnd::new("chapter"))).unwrap();
        }
        writer.write_event(Event::End(BytesEnd::new("chapters"))).unwrap();
        writer.write_event(Event::End(BytesEnd::new("book"))).unwrap();
    }
    writer.write_event(Event::End(BytesEnd::new("books"))).unwrap();
    let mut output = writer.into_inner();
    output.flush().unwrap();
    let bytes = std::fs::metadata(&output_path).unwrap().len();
    let seconds = started.elapsed().as_secs_f64();
    println!("{{\"records\":{records},\"bytes\":{bytes},\"seconds\":{seconds:.9},\"throughputMiBs\":{:.6}}}", bytes as f64 / 1048576.0 / seconds);
}

public class Main {
    public static void main(String[] args) {
        // 1. Étudiant standard
        Student student1 = new Student("Aurelia", 20241370);
        Student.AcademicRecord record1 = student1.new AcademicRecord("Maths", 97);
        record1.displayRecord();

        PostgraduateStudent student2 = new PostgraduateStudent("Alexis", 20241280, "Master");
        Student.AcademicRecord record2 = student2.new PostgraduateAcademicRecord("Web", 93);
        record2.displayRecord();

        try {
            Student student3 = new Student("Louise", 20241278);
            Student.AcademicRecord record3 = student3.new AcademicRecord("Maths", 102);
            record3.displayRecord();
        } catch (IllegalArgumentException exc) {
            System.out.println("Exception found: " + exc.getMessage());
        }
    }
}